-- =====================================================================
-- Tierra Santa · 0008 · Vistas y funciones de saldos (agregados en BD).
-- Las vistas usan security_invoker para respetar RLS del usuario.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes: saldo por cliente y moneda
-- saldo = Σ saldos pendientes de facturas − saldo a favor
-- ---------------------------------------------------------------------
create or replace view public.v_saldos_clientes_moneda with (security_invoker = true) as
with f as (
  select cliente_id, moneda,
         sum(total) filter (where estado = 'emitida') facturado,
         sum(pagado) filter (where estado = 'emitida') pagado_facturas,
         sum(saldo) pendiente,
         count(*) filter (where estado = 'emitida' and saldo > 0) facturas_pendientes,
         min(fecha) filter (where estado = 'emitida' and saldo > 0) pendiente_desde
    from public.facturas where estado = 'emitida'
   group by cliente_id, moneda),
p as (
  select pc.cliente_id, pc.moneda, sum(pc.monto) recibido,
         sum(pc.monto) - coalesce(sum(ap.aplicado), 0) a_favor
    from public.pagos_clientes pc
    left join (select pago_id, sum(monto) aplicado from public.pago_aplicaciones group by pago_id) ap
      on ap.pago_id = pc.id
   group by pc.cliente_id, pc.moneda)
select coalesce(f.cliente_id, p.cliente_id) cliente_id,
       coalesce(f.moneda, p.moneda) moneda,
       coalesce(f.facturado, 0) facturado,
       coalesce(p.recibido, 0) recibido,
       coalesce(f.pendiente, 0) pendiente_facturas,
       coalesce(p.a_favor, 0) saldo_a_favor,
       coalesce(f.pendiente, 0) - coalesce(p.a_favor, 0) saldo,
       coalesce(f.facturas_pendientes, 0) facturas_pendientes,
       f.pendiente_desde
  from f full join p on p.cliente_id = f.cliente_id and p.moneda = f.moneda;

-- Resumen por cliente (una fila): saldos USD/COP/VES, cajas, moneda y estado
create or replace view public.v_resumen_clientes with (security_invoker = true) as
with s as (
  select cliente_id,
         sum(saldo) filter (where moneda = 'USD') saldo_usd,
         sum(saldo) filter (where moneda = 'COP') saldo_cop,
         sum(saldo) filter (where moneda = 'VES') saldo_ves,
         sum(facturas_pendientes) facturas_pendientes,
         min(pendiente_desde) pendiente_desde
    from public.v_saldos_clientes_moneda group by cliente_id),
e as (
  select cliente_id, sum(retiradas) retiradas, sum(devueltas) devueltas
    from public.empaques_clientes group by cliente_id)
select c.id, c.numero, c.nombre, c.documento, c.telefono, c.activo, c.search,
       upper(left(public.f_unaccent(trim(c.nombre)), 1)) letra,
       coalesce(s.saldo_usd, 0) saldo_usd,
       coalesce(s.saldo_cop, 0) saldo_cop,
       coalesce(s.saldo_ves, 0) saldo_ves,
       coalesce(e.retiradas, 0) cajas_retiradas,
       coalesce(e.devueltas, 0) cajas_devueltas,
       coalesce(e.retiradas, 0) - coalesce(e.devueltas, 0) cajas_pendientes,
       coalesce(s.facturas_pendientes, 0) facturas_pendientes,
       s.pendiente_desde,
       nullif(concat_ws('/',
         case when coalesce(s.saldo_usd, 0) > 0 then 'USD' end,
         case when coalesce(s.saldo_cop, 0) > 0 then 'COP' end,
         case when coalesce(s.saldo_ves, 0) > 0 then 'VES' end), '') moneda,
       case when coalesce(s.saldo_usd, 0) > 0 or coalesce(s.saldo_cop, 0) > 0 or coalesce(s.saldo_ves, 0) > 0
            then 'CRÍTICO' else 'AL DÍA' end estado
  from public.clientes c
  left join s on s.cliente_id = c.id
  left join e on e.cliente_id = c.id;

-- KPIs del panel de clientes
create or replace function public.kpis_clientes()
returns jsonb language sql stable security invoker
as $$
  select jsonb_build_object(
    'clientes', count(*) filter (where activo),
    'saldo_usd', coalesce(sum(saldo_usd) filter (where saldo_usd > 0), 0),
    'saldo_cop', coalesce(sum(saldo_cop) filter (where saldo_cop > 0), 0),
    'saldo_ves', coalesce(sum(saldo_ves) filter (where saldo_ves > 0), 0),
    'cajas_pendientes', coalesce(sum(cajas_pendientes), 0),
    'al_dia', count(*) filter (where activo and estado = 'AL DÍA'),
    'criticos', count(*) filter (where estado = 'CRÍTICO'))
  from public.v_resumen_clientes
$$;

-- Antigüedad de saldos por cliente y moneda a una fecha de corte
create or replace function public.antiguedad_cxc(p_corte date default public.hoy(), p_moneda text default null)
returns table (cliente_id bigint, numero integer, nombre text, moneda text,
               d0_15 numeric, d16_30 numeric, d31_60 numeric, d60_mas numeric, total numeric)
language sql stable security invoker
as $$
  select c.id, c.numero, c.nombre, f.moneda,
         sum(f.saldo) filter (where p_corte - f.fecha <= 15),
         sum(f.saldo) filter (where p_corte - f.fecha between 16 and 30),
         sum(f.saldo) filter (where p_corte - f.fecha between 31 and 60),
         sum(f.saldo) filter (where p_corte - f.fecha > 60),
         sum(f.saldo)
    from public.facturas f join public.clientes c on c.id = f.cliente_id
   where f.estado = 'emitida' and f.saldo > 0 and f.fecha <= p_corte
     and (p_moneda is null or f.moneda = p_moneda)
   group by c.id, c.numero, c.nombre, f.moneda
   order by sum(f.saldo) desc
$$;

-- ---------------------------------------------------------------------
-- Proveedores: saldo a favor del proveedor por moneda = Σ entregas − Σ abonos
-- ---------------------------------------------------------------------
create or replace view public.v_saldos_proveedores_moneda with (security_invoker = true) as
with e as (
  select proveedor_id, moneda, sum(total) entregas, sum(kg_total) kg, sum(merma) merma,
         sum(peso_neto) peso_neto, count(*) n_entregas, max(fecha) ultima_entrega
    from public.entregas_proveedor group by proveedor_id, moneda),
a as (
  select proveedor_id, moneda, sum(monto) abonos, count(*) n_abonos, max(fecha) ultimo_abono
    from public.abonos_proveedor group by proveedor_id, moneda)
select coalesce(e.proveedor_id, a.proveedor_id) proveedor_id,
       coalesce(e.moneda, a.moneda) moneda,
       coalesce(e.entregas, 0) total_entregas,
       coalesce(a.abonos, 0) total_abonos,
       coalesce(e.entregas, 0) - coalesce(a.abonos, 0) saldo,
       coalesce(e.kg, 0) kg_total, coalesce(e.merma, 0) merma, coalesce(e.peso_neto, 0) peso_neto,
       coalesce(e.n_entregas, 0) n_entregas, coalesce(a.n_abonos, 0) n_abonos,
       e.ultima_entrega, a.ultimo_abono
  from e full join a on a.proveedor_id = e.proveedor_id and a.moneda = e.moneda;

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
       (coalesce(s.saldo_cop, 0) > 0 or coalesce(s.saldo_usd, 0) > 0 or coalesce(s.saldo_ves, 0) > 0) con_saldo
  from public.proveedores p
  left join s on s.proveedor_id = p.id
  left join c on c.proveedor_id = p.id;

create or replace function public.kpis_proveedores()
returns jsonb language sql stable security invoker
as $$
  select jsonb_build_object(
    'proveedores', count(*) filter (where activo),
    'saldo_cop', coalesce(sum(saldo_cop), 0),
    'saldo_usd', coalesce(sum(saldo_usd), 0),
    'saldo_ves', coalesce(sum(saldo_ves), 0),
    'cestas_pendientes', coalesce(sum(cestas_pendientes), 0),
    'con_saldo', count(*) filter (where con_saldo))
  from public.v_resumen_proveedores
$$;

-- ---------------------------------------------------------------------
-- Inventario: stock por producto/ubicación con indicador
-- ---------------------------------------------------------------------
create or replace view public.v_stock with (security_invoker = true) as
select p.id producto_id, p.codigo, p.nombre, p.emoji, p.unidad, p.tipo, p.stock_minimo,
       u.id ubicacion_id, u.nombre ubicacion, e.forma,
       sum(e.cantidad) cantidad,
       case when sum(e.cantidad) <= 0 then 'agotado'
            when sum(e.cantidad) < p.stock_minimo then 'bajo'
            else 'normal' end indicador
  from public.existencias e
  join public.productos p on p.id = e.producto_id
  join public.ubicaciones u on u.id = e.ubicacion_id
 group by p.id, u.id, e.forma;

-- Stock total por producto (todas las ubicaciones), para alertas
create or replace view public.v_stock_total with (security_invoker = true) as
select p.id producto_id, p.codigo, p.nombre, p.emoji, p.unidad, p.tipo, p.stock_minimo, p.activo,
       coalesce(sum(e.cantidad) filter (where e.forma = 'PT'), 0) stock_pt,
       coalesce(sum(e.cantidad) filter (where e.forma = 'MP'), 0) stock_mp,
       case when coalesce(sum(e.cantidad) filter (where e.forma = public.forma_venta(p.id)), 0) <= 0 then 'agotado'
            when coalesce(sum(e.cantidad) filter (where e.forma = public.forma_venta(p.id)), 0) < p.stock_minimo then 'bajo'
            else 'normal' end indicador
  from public.productos p
  left join public.existencias e on e.producto_id = p.id
 group by p.id;

-- Kardex: movimientos con saldo corrido por producto (y opcionalmente ubicación/forma)
create or replace function public.kardex(
  p_producto_id bigint, p_desde date default null, p_hasta date default null,
  p_ubicacion_id bigint default null, p_forma public.forma_inventario default null)
returns table (id bigint, fecha timestamptz, tipo public.tipo_movimiento, ubicacion text, forma public.forma_inventario,
               entrada numeric, salida numeric, saldo numeric, referencia text, nota text, usuario text)
language sql stable security invoker
as $$
  with base as (
    select m.*, sum(m.cantidad) over (order by m.fecha, m.id) as corrido
      from public.movimientos_inventario m
     where m.producto_id = p_producto_id
       and (p_ubicacion_id is null or m.ubicacion_id = p_ubicacion_id)
       and (p_forma is null or m.forma = p_forma)
       and (p_hasta is null or (m.fecha at time zone 'America/Caracas')::date <= p_hasta))
  select b.id, b.fecha, b.tipo, u.nombre, b.forma,
         case when b.cantidad > 0 then b.cantidad end,
         case when b.cantidad < 0 then -b.cantidad end,
         b.corrido,
         case when b.factura_id is not null then 'Factura ' || coalesce(f.numero::text, f.numero_externo)
              when b.entrega_id is not null then 'Entrega #' || b.entrega_id
              when b.produccion_id is not null then 'Producción #' || b.produccion_id
              when b.traslado_id is not null then 'Traslado'
              else null end,
         b.nota, pr.email
    from base b
    join public.ubicaciones u on u.id = b.ubicacion_id
    left join public.facturas f on f.id = b.factura_id
    left join public.profiles pr on pr.id = b.created_by
   where p_desde is null or (b.fecha at time zone 'America/Caracas')::date >= p_desde
   order by b.fecha, b.id
$$;

-- ---------------------------------------------------------------------
-- Nómina: saldo neto por empleado = ganado − abonos
-- ---------------------------------------------------------------------
create or replace view public.v_resumen_empleados with (security_invoker = true) as
with j as (
  select empleado_id, count(*) filter (where estado <> 'no') jornadas, sum(ganado) ganado,
         max(fecha) ultima_jornada
    from public.jornadas group by empleado_id),
a as (
  select empleado_id, sum(monto) abonos, count(*) n_abonos
    from public.abonos_empleados group by empleado_id)
select e.id, e.codigo, e.nombre, e.cedula, e.tipo, e.tarifa_dia, e.cargo, e.activo, e.search,
       upper(left(public.f_unaccent(trim(e.nombre)), 1)) letra,
       coalesce(j.jornadas, 0) jornadas, coalesce(j.ganado, 0) ganado,
       coalesce(a.abonos, 0) abonos, coalesce(a.n_abonos, 0) n_abonos,
       coalesce(j.ganado, 0) - coalesce(a.abonos, 0) saldo_neto,
       j.ultima_jornada
  from public.empleados e
  left join j on j.empleado_id = e.id
  left join a on a.empleado_id = e.id;
