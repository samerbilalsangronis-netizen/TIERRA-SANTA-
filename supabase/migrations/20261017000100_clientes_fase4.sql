-- =====================================================================
-- Tierra Santa · Fase 4 · Clientes
-- Búsqueda con filtros, estado de cuenta por moneda, edición de facturas
-- externas/históricas y endurecimiento de permisos de funciones.
-- =====================================================================

-- 1) Panel de clientes: búsqueda y filtros en el servidor
--    p_estado: 'CRÍTICO' | 'AL DÍA' · p_moneda: con saldo pendiente (> 0) en esa moneda
create or replace function public.buscar_clientes(
  p_q text default null, p_estado text default null, p_moneda text default null,
  p_incluir_inactivos boolean default false)
returns setof public.v_resumen_clientes
language sql stable security invoker
set search_path = public, extensions
as $$
  select r.* from public.v_resumen_clientes r
   where (p_incluir_inactivos or r.activo)
     and (coalesce(trim(p_q), '') = ''
          or r.search like '%' || public.normalizar(p_q) || '%'
          or r.numero::text = trim(p_q))
     and (p_estado is null or r.estado = p_estado)
     and (p_moneda is null
          or (p_moneda = 'USD' and r.saldo_usd > 0)
          or (p_moneda = 'COP' and r.saldo_cop > 0)
          or (p_moneda = 'VES' and r.saldo_ves > 0))
   order by public.normalizar(r.nombre)
$$;

-- 2) Estado de cuenta de un cliente en una moneda.
--    Cargos = facturas emitidas · Abonos = pagos recibidos (y conversiones).
--    Saldo > 0 = el cliente debe; < 0 = saldo a favor del cliente.
create or replace function public.estado_cuenta_cliente(
  p_cliente_id bigint, p_moneda text, p_desde date default null, p_hasta date default null)
returns table (fecha date, tipo text, ref_id bigint, documento text, detalle text,
               cargo numeric, abono numeric, saldo numeric)
language sql stable security invoker
set search_path = public
as $$
  with emp as (select factura_prefijo, titulo_documento from public.empresa where id = 1),
  mov as (
    select f.fecha, 'factura'::text tipo, f.id ref_id,
           case when f.origen = 'externa' then coalesce(f.numero_externo, 's/n')
                else (select factura_prefijo from emp) || f.numero::text end documento,
           case when f.origen = 'externa' then 'Factura (histórica)' else (select titulo_documento from emp) end
             || coalesce(' · ' || f.observaciones, '') detalle,
           f.total cargo, 0::numeric abono, 1 orden
      from public.facturas f
     where f.cliente_id = p_cliente_id and f.moneda = p_moneda and f.estado = 'emitida'
    union all
    select p.fecha, case when p.tipo = 'conversion' then 'conversion' else 'pago' end, p.id,
           'Recibo ' || p.numero,
           case when p.tipo = 'conversion' then coalesce(p.nota, 'Conversión de moneda')
                else 'Pago' || coalesce(' · ' || m.nombre, '') || coalesce(' · Ref. ' || p.referencia, '')
                     || coalesce(' · ' || p.nota, '') end,
           0, p.monto, 2
      from public.pagos_clientes p left join public.metodos_pago m on m.id = p.metodo_id
     where p.cliente_id = p_cliente_id and p.moneda = p_moneda),
  anterior as (
    select coalesce(sum(cargo - abono), 0) s from mov where p_desde is not null and mov.fecha < p_desde),
  rango as (
    select * from mov where (p_desde is null or mov.fecha >= p_desde) and (p_hasta is null or mov.fecha <= p_hasta))
  select p_desde, 'saldo_anterior', null::bigint, null::text, 'Saldo anterior', null::numeric, null::numeric, (select s from anterior)
   where p_desde is not null
  union all
  (select r.fecha, r.tipo, r.ref_id, r.documento, r.detalle, r.cargo, r.abono,
          (select s from anterior) + sum(r.cargo - r.abono) over (order by r.fecha, r.orden, r.ref_id)
     from rango r order by r.fecha, r.orden, r.ref_id)
$$;

-- 3) Editar una factura externa/histórica (número, fecha, moneda, monto, soporte)
create or replace function public.editar_factura_externa(p jsonb)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v public.facturas; v_total numeric := (p->>'total')::numeric; v_antes jsonb;
begin
  perform public.exigir_rol('admin', 'facturacion');
  select * into v from public.facturas where id = (p->>'id')::bigint for update;
  if v.id is null or v.origen <> 'externa' then raise exception 'Factura externa no encontrada.'; end if;
  if v.estado = 'anulada' then raise exception 'Una factura anulada no se puede editar.'; end if;
  if v_total is null or v_total < 0 then raise exception 'Indica el monto de la factura.'; end if;
  if v.pagado > 0 and coalesce(p->>'moneda', v.moneda) <> v.moneda then
    raise exception 'La factura tiene pagos aplicados en %: no se puede cambiar la moneda.', v.moneda;
  end if;
  if v_total < v.pagado then
    raise exception 'El monto (%) no puede ser menor a lo ya pagado (%).', v_total, v.pagado;
  end if;
  v_antes := to_jsonb(v);
  update public.facturas set
    numero_externo = nullif(trim(p->>'numero_externo'), ''),
    fecha = coalesce((p->>'fecha')::date, fecha),
    moneda = coalesce(p->>'moneda', moneda),
    observaciones = nullif(trim(p->>'observaciones'), ''),
    exento = v_total, subtotal = v_total, total = v_total,
    soporte_url = case when p ? 'soporte_url' then nullif(p->>'soporte_url', '') else soporte_url end,
    soporte_path = case when p ? 'soporte_path' then nullif(p->>'soporte_path', '') else soporte_path end
  where id = v.id;
  perform public.auditar('EDITAR', 'facturas', v.id::text, v_antes, to_jsonb((select f from public.facturas f where f.id = v.id)));
end $$;

-- 4) Permisos: los anónimos no ejecutan funciones (salvo los datos públicos del inicio)
revoke execute on all functions in schema public from anon;
grant execute on function public.empresa_publica() to anon;
grant execute on function public.buscar_clientes(text, text, text, boolean) to authenticated;
grant execute on function public.estado_cuenta_cliente(bigint, text, date, date) to authenticated;
grant execute on function public.editar_factura_externa(jsonb) to authenticated;
