-- =====================================================================
-- Tierra Santa · Fase 3 · Proveedores
-- 1) Las entregas de proveedores YA NO suman al inventario: el inventario
--    solo crece con las entradas de producción que registra la planta
--    (la fruta se procesa antes de ser producto final).
-- 2) Búsqueda de proveedores con filtros y estado de cuenta por moneda.
-- =====================================================================

-- 1) Quitar la entrada automática de entregas al inventario
drop trigger if exists entregas_inventario_iu on public.entregas_proveedor;
drop trigger if exists entregas_inventario_d on public.entregas_proveedor;
drop function if exists public.tg_entrega_inventario();
alter table public.empresa drop column if exists entregas_ubicacion_id;
alter table public.empresa drop column if exists entregas_suman_inventario;

-- 2) Panel de proveedores: búsqueda y filtros del lado del servidor
--    p_moneda: solo proveedores con saldo pendiente (> 0) en esa moneda
--    p_producto / p_desde / p_hasta: proveedores con entregas de ese rubro / en ese rango
create or replace function public.buscar_proveedores(
  p_q text default null, p_moneda text default null, p_con_saldo boolean default false,
  p_producto bigint default null, p_desde date default null, p_hasta date default null,
  p_incluir_inactivos boolean default false)
returns setof public.v_resumen_proveedores
language sql stable security invoker
set search_path = public, extensions
as $$
  select r.* from public.v_resumen_proveedores r
   where (p_incluir_inactivos or r.activo)
     and (coalesce(trim(p_q), '') = '' or r.search like '%' || public.normalizar(p_q) || '%')
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

-- 3) Estado de cuenta de un proveedor en una moneda
--    Primera fila: saldo anterior a p_desde. Luego entregas (cargo) y abonos (abono)
--    en orden cronológico con saldo corrido. Saldo > 0 = se le debe al proveedor.
create or replace function public.estado_cuenta_proveedor(
  p_proveedor_id bigint, p_moneda text, p_desde date default null, p_hasta date default null)
returns table (fecha date, tipo text, ref_id bigint, detalle text, cestas numeric, kg numeric, merma numeric,
               cargo numeric, abono numeric, saldo numeric)
language sql stable security invoker
set search_path = public
as $$
  with mov as (
    select e.fecha, 'entrega'::text tipo, e.id ref_id,
           p.nombre || case when e.modo_pesaje = 'FIJO' then ' · ' || replace(trim_scale(e.cestas)::text, '.', ',') || ' cestas' else '' end
             || case when e.nota is not null then ' · ' || e.nota else '' end detalle,
           e.cestas, e.kg_total kg, e.merma, e.total cargo, 0::numeric abono, 1 orden
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

grant execute on function public.buscar_proveedores(text, text, boolean, bigint, date, date, boolean) to authenticated;
grant execute on function public.estado_cuenta_proveedor(bigint, text, date, date) to authenticated;
