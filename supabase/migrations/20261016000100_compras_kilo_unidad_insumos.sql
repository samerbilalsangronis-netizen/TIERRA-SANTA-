-- =====================================================================
-- Tierra Santa · Compras por kilo, por unidad y proveedores de insumos
--
-- Modos de compra de una entrega (columna modo_pesaje, ahora texto):
--   KG       → kg × precio por kilo;            merma en kg
--   UNIDAD   → unidades × precio por unidad;     merma = unidades dañadas
--   FIJO     → cestas × precio por cesta (kg = cestas × kg por cesta)
--   VARIABLE → precio total por un peso total (solo datos del sistema anterior)
-- En todos: total = bruto − merma × precio unitario.
--
-- Productos: nueva columna "categoria" (fruta / insumo). Los insumos
-- (bolsas, etiquetas…) se compran a proveedores pero no se facturan.
-- Proveedores: nueva columna "tipo" (fruta / insumos / ambos).
-- =====================================================================

-- 1) modo_pesaje: de enum a texto con validación
drop trigger if exists entregas_calcular on public.entregas_proveedor;
drop function if exists public.tg_entrega_calcular();
drop function if exists public.calcular_entrega(public.modo_pesaje, numeric, numeric, numeric, numeric, numeric);

alter table public.productos drop constraint if exists productos_fijo_requiere_kg;
alter table public.productos alter column modo_pesaje drop default;
alter table public.productos alter column modo_pesaje type text using modo_pesaje::text;
alter table public.entregas_proveedor alter column modo_pesaje type text using modo_pesaje::text;
drop type if exists public.modo_pesaje;

alter table public.productos alter column modo_pesaje set default 'KG';
alter table public.productos add constraint productos_modo_compra
  check (modo_pesaje in ('KG', 'UNIDAD', 'FIJO', 'VARIABLE'));
alter table public.productos add constraint productos_cesta_requiere_kg
  check (modo_pesaje <> 'FIJO' or kg_por_cesta is not null);
alter table public.entregas_proveedor add constraint entregas_modo_compra
  check (modo_pesaje in ('KG', 'UNIDAD', 'FIJO', 'VARIABLE'));

-- 2) Unidades compradas (modo UNIDAD)
alter table public.entregas_proveedor
  add column if not exists unidades numeric(12,2) not null default 0 check (unidades >= 0);

-- 3) Categoría de producto y tipo de proveedor
alter table public.productos
  add column if not exists categoria text not null default 'fruta' check (categoria in ('fruta', 'insumo'));
alter table public.proveedores
  add column if not exists tipo text not null default 'fruta' check (tipo in ('fruta', 'insumos', 'ambos'));

-- 4) Cálculo de una entrega
create or replace function public.calcular_entrega(
  p_modo text, p_kg_por_cesta numeric, p_cestas numeric, p_kg_total numeric, p_unidades numeric,
  p_precio numeric, p_merma numeric,
  out kg_total numeric, out precio_kg numeric, out desc_merma numeric, out total numeric, out peso_neto numeric)
language plpgsql immutable
as $$
declare v_merma numeric := coalesce(p_merma, 0); v_cant numeric;
begin
  if p_modo = 'KG' then
    if coalesce(p_kg_total, 0) <= 0 then raise exception 'Indica los kilos recibidos.'; end if;
    if v_merma > p_kg_total then raise exception 'La merma (% kg) no puede superar los kilos recibidos (% kg).', v_merma, p_kg_total; end if;
    kg_total := p_kg_total;
    precio_kg := p_precio;
    desc_merma := round(v_merma * p_precio, 2);
    total := round(p_kg_total * p_precio, 2) - desc_merma;
    peso_neto := p_kg_total - v_merma;
  elsif p_modo = 'UNIDAD' then
    v_cant := coalesce(p_unidades, 0);
    if v_cant <= 0 then raise exception 'Indica las unidades recibidas.'; end if;
    if v_merma > v_cant then raise exception 'Las unidades dañadas (%) no pueden superar las recibidas (%).', v_merma, v_cant; end if;
    kg_total := 0;
    precio_kg := p_precio;                        -- precio por unidad
    desc_merma := round(v_merma * p_precio, 2);
    total := round(v_cant * p_precio, 2) - desc_merma;
    peso_neto := 0;
  elsif p_modo = 'FIJO' then
    if coalesce(p_kg_por_cesta, 0) <= 0 then raise exception 'La compra por cesta requiere kg por cesta mayor a 0.'; end if;
    kg_total := round(coalesce(p_cestas, 0) * p_kg_por_cesta, 3);
    if v_merma > kg_total then raise exception 'La merma (% kg) no puede superar el peso total (% kg).', v_merma, kg_total; end if;
    precio_kg := round(p_precio / p_kg_por_cesta, 4);
    desc_merma := round(v_merma * p_precio / p_kg_por_cesta, 2);
    total := round(coalesce(p_cestas, 0) * p_precio, 2) - desc_merma;
    peso_neto := kg_total - v_merma;
  elsif p_modo = 'VARIABLE' then
    if coalesce(p_kg_total, 0) <= 0 then raise exception 'Indica el total de kg.'; end if;
    if v_merma > p_kg_total then raise exception 'La merma (% kg) no puede superar el peso total (% kg).', v_merma, p_kg_total; end if;
    kg_total := p_kg_total;
    precio_kg := round(p_precio / p_kg_total, 4);
    desc_merma := round(v_merma * p_precio / p_kg_total, 2);
    total := p_precio - desc_merma;
    peso_neto := p_kg_total - v_merma;
  else
    raise exception 'Modo de compra no válido: %', p_modo;
  end if;
end $$;

-- 5) Trigger: el modo lo elige quien registra (por defecto el del producto);
--    los kg por cesta se copian del producto al crear o al cambiar de rubro.
create or replace function public.tg_entrega_calcular()
returns trigger language plpgsql as $$
declare v_prod public.productos; r record;
begin
  if tg_op = 'INSERT' or new.producto_id <> old.producto_id or new.modo_pesaje is distinct from old.modo_pesaje then
    select * into v_prod from public.productos where id = new.producto_id;
    new.modo_pesaje := coalesce(new.modo_pesaje, v_prod.modo_pesaje);
    if new.modo_pesaje = 'FIJO' and (new.kg_por_cesta is null or tg_op = 'UPDATE' and new.producto_id <> old.producto_id) then
      new.kg_por_cesta := v_prod.kg_por_cesta;
    end if;
  end if;
  select * into r from public.calcular_entrega(new.modo_pesaje, new.kg_por_cesta, new.cestas,
                                               new.kg_total, new.unidades, new.precio, new.merma);
  new.kg_total := r.kg_total; new.precio_kg := r.precio_kg; new.desc_merma := r.desc_merma;
  new.total := r.total; new.peso_neto := r.peso_neto;
  return new;
end $$;
create trigger entregas_calcular before insert or update on public.entregas_proveedor
  for each row execute function public.tg_entrega_calcular();

-- 6) Las frutas iniciales pasan a comprarse por kilo (y la piña por unidad).
--    Se pueden cambiar en Configuración → Catálogos → Productos.
update public.productos set modo_pesaje = 'KG' where modo_pesaje = 'VARIABLE' and categoria = 'fruta';
update public.productos set modo_pesaje = 'KG' where modo_pesaje = 'FIJO' and categoria = 'fruta'
   and codigo between 1 and 9 and public.normalizar(nombre) <> 'pina';
update public.productos set modo_pesaje = 'UNIDAD' where public.normalizar(nombre) = 'pina';

-- 7) Vista de proveedores con su tipo (se agrega al final de las columnas)
drop function if exists public.buscar_proveedores(text, text, boolean, bigint, date, date, boolean);
create or replace view public.v_resumen_proveedores with (security_invoker = true) as
with s as (
  select proveedor_id,
         sum(saldo) filter (where moneda = 'COP') saldo_cop,
         sum(saldo) filter (where moneda = 'USD') saldo_usd,
         sum(saldo) filter (where moneda = 'VES') saldo_ves,
         max(ultima_entrega) ultima_entrega
    from public.v_saldos_proveedores_moneda group by proveedor_id),
c as (
  select proveedor_id, sum(entregadas) entregadas, sum(devueltas) devueltas
    from public.cestas_proveedor group by proveedor_id)
select p.id, p.nombre, p.documento, p.telefono, p.ubicacion, p.moneda_habitual, p.activo, p.search,
       upper(left(public.f_unaccent(trim(p.nombre)), 1)) letra,
       coalesce(s.saldo_cop, 0) saldo_cop,
       coalesce(s.saldo_usd, 0) saldo_usd,
       coalesce(s.saldo_ves, 0) saldo_ves,
       coalesce(c.entregadas, 0) cestas_entregadas,
       coalesce(c.devueltas, 0) cestas_devueltas,
       coalesce(c.entregadas, 0) - coalesce(c.devueltas, 0) cestas_pendientes,
       s.ultima_entrega,
       (coalesce(s.saldo_cop, 0) > 0 or coalesce(s.saldo_usd, 0) > 0 or coalesce(s.saldo_ves, 0) > 0) con_saldo,
       p.tipo
  from public.proveedores p
  left join s on s.proveedor_id = p.id
  left join c on c.proveedor_id = p.id;

-- 8) Búsqueda con filtro por tipo de proveedor
create or replace function public.buscar_proveedores(
  p_q text default null, p_moneda text default null, p_con_saldo boolean default false,
  p_producto bigint default null, p_desde date default null, p_hasta date default null,
  p_incluir_inactivos boolean default false, p_tipo text default null)
returns setof public.v_resumen_proveedores
language sql stable security invoker
set search_path = public, extensions
as $$
  select r.* from public.v_resumen_proveedores r
   where (p_incluir_inactivos or r.activo)
     and (coalesce(trim(p_q), '') = '' or r.search like '%' || public.normalizar(p_q) || '%')
     and (p_tipo is null or r.tipo = p_tipo or r.tipo = 'ambos')
     and (p_moneda is null
          or (p_moneda = 'COP' and r.saldo_cop > 0)
          or (p_moneda = 'USD' and r.saldo_usd > 0)
          or (p_moneda = 'VES' and r.saldo_ves > 0))
     and (not p_con_saldo or r.con_saldo)
     and (p_producto is null and p_desde is null and p_hasta is null
          or exists (select 1 from public.entregas_proveedor e
                      where e.proveedor_id = r.id
                        and (p_producto is null or e.producto_id = p_producto)
                        and (p_desde is null or e.fecha >= p_desde)
                        and (p_hasta is null or e.fecha <= p_hasta)))
   order by public.normalizar(r.nombre)
$$;

-- 9) Estado de cuenta con el detalle según el modo de compra
create or replace function public.estado_cuenta_proveedor(
  p_proveedor_id bigint, p_moneda text, p_desde date default null, p_hasta date default null)
returns table (fecha date, tipo text, ref_id bigint, detalle text, cestas numeric, kg numeric, merma numeric,
               cargo numeric, abono numeric, saldo numeric)
language sql stable security invoker
set search_path = public
as $$
  with mov as (
    select e.fecha, 'entrega'::text tipo, e.id ref_id,
           p.nombre || ' · ' ||
           case e.modo_pesaje
             when 'KG' then replace(trim_scale(e.kg_total)::text, '.', ',') || ' kg × ' || replace(trim_scale(e.precio)::text, '.', ',')
             when 'UNIDAD' then replace(trim_scale(e.unidades)::text, '.', ',') || ' und × ' || replace(trim_scale(e.precio)::text, '.', ',')
             when 'FIJO' then replace(trim_scale(e.cestas)::text, '.', ',') || ' cestas × ' || replace(trim_scale(e.precio)::text, '.', ',')
             else replace(trim_scale(e.kg_total)::text, '.', ',') || ' kg (precio total)'
           end
           || case when e.merma > 0 then ' · merma ' || replace(trim_scale(e.merma)::text, '.', ',')
                   || case when e.modo_pesaje = 'UNIDAD' then ' und' else ' kg' end else '' end
           || case when e.nota is not null then ' · ' || e.nota else '' end detalle,
           e.cestas, nullif(e.kg_total, 0) kg, case when e.modo_pesaje = 'UNIDAD' then null else e.merma end merma,
           e.total cargo, 0::numeric abono, 1 orden
      from public.entregas_proveedor e join public.productos p on p.id = e.producto_id
     where e.proveedor_id = p_proveedor_id and e.moneda = p_moneda
    union all
    select a.fecha, 'abono', a.id,
           'Abono' || coalesce(' · ' || m.nombre, '') || coalesce(' · Ref. ' || a.referencia, '')
             || coalesce(' · ' || a.pagado_por, '') || coalesce(' · ' || a.nota, ''),
           null, null, null, 0, a.monto, 2
      from public.abonos_proveedor a left join public.metodos_pago m on m.id = a.metodo_id
     where a.proveedor_id = p_proveedor_id and a.moneda = p_moneda),
  anterior as (
    select coalesce(sum(cargo - abono), 0) s from mov where p_desde is not null and mov.fecha < p_desde),
  rango as (
    select * from mov
     where (p_desde is null or mov.fecha >= p_desde) and (p_hasta is null or mov.fecha <= p_hasta))
  select p_desde, 'saldo_anterior', null::bigint, 'Saldo anterior', null::numeric, null::numeric, null::numeric,
         null::numeric, null::numeric, (select s from anterior)
   where p_desde is not null
  union all
  (select r.fecha, r.tipo, r.ref_id, r.detalle, r.cestas, r.kg, r.merma, r.cargo, r.abono,
          (select s from anterior) + sum(r.cargo - r.abono) over (order by r.fecha, r.orden, r.ref_id)
     from rango r
    order by r.fecha, r.orden, r.ref_id)
$$;

grant execute on function public.buscar_proveedores(text, text, boolean, bigint, date, date, boolean, text) to authenticated;
grant execute on function public.estado_cuenta_proveedor(bigint, text, date, date) to authenticated;
grant execute on function public.calcular_entrega(text, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
grant select on public.v_resumen_proveedores to authenticated;
