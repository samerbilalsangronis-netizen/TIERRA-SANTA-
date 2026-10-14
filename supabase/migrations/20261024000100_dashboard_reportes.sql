-- =====================================================================
-- Tierra Santa · Fase 8 · Dashboard, métricas y reportes
-- Todas las agregaciones se hacen aquí (Postgres), no en la app.
-- Ventas = facturas emitidas (las anuladas y los borradores no cuentan).
-- =====================================================================

-- 1) Resumen de un periodo (el dashboard lo pide para el periodo y el anterior)
create or replace function public.resumen_periodo(p_desde date, p_hasta date)
returns jsonb language sql stable security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'ventas', coalesce((
      select jsonb_agg(jsonb_build_object('moneda', moneda, 'facturas', n, 'total', total) order by moneda)
        from (select moneda, count(*) n, sum(total) total from public.facturas
               where estado = 'emitida' and fecha between p_desde and p_hasta group by moneda) v), '[]'::jsonb),
    'cobrado', coalesce((
      select jsonb_agg(jsonb_build_object('moneda', moneda, 'total', total) order by moneda)
        from (select moneda, sum(monto) total from public.pagos_clientes
               where tipo = 'pago' and fecha between p_desde and p_hasta group by moneda) c), '[]'::jsonb),
    'compras', coalesce((
      select jsonb_agg(jsonb_build_object('moneda', moneda, 'total', total, 'kg', kg, 'merma', merma) order by moneda)
        from (select moneda, sum(total) total, sum(kg_total) kg, sum(merma) filter (where modo_pesaje <> 'UNIDAD') merma
                from public.entregas_proveedor where fecha between p_desde and p_hasta group by moneda) e), '[]'::jsonb),
    -- Productos finales vendidos: unidades (bolsas) y kg de pulpa (unidades × kg por bolsa)
    'vendido', (select jsonb_build_object(
        'unidades', coalesce(sum(l.cantidad), 0),
        'kg', coalesce(sum(l.cantidad * coalesce(p.peso_kg, case when p.unidad = 'kg' then 1 end)), 0))
      from public.factura_lineas l
      join public.facturas f on f.id = l.factura_id
      join public.productos p on p.id = l.producto_id
     where f.estado = 'emitida' and f.fecha between p_desde and p_hasta),
    'produccion_kg', coalesce((select sum(kg) from public.pulpa_por_fruta(p_desde, p_hasta)), 0),
    'nomina', case when public.es_admin() then (
      select jsonb_build_object('ganado', coalesce(sum(ganado), 0), 'abonos',
               coalesce((select sum(monto) from public.abonos_empleados where fecha between p_desde and p_hasta and tipo = 'adelanto'), 0))
        from public.jornadas where fecha between p_desde and p_hasta) end)
$$;

-- 2) Ventas por día (con los días sin ventas en 0)
create or replace function public.ventas_por_dia(p_desde date, p_hasta date, p_moneda text)
returns table (fecha date, total numeric, facturas bigint)
language sql stable security invoker
set search_path = public
as $$
  select d::date, coalesce(sum(f.total), 0), count(f.id)
    from generate_series(p_desde, p_hasta, interval '1 day') d
    left join public.facturas f on f.fecha = d::date and f.estado = 'emitida' and f.moneda = p_moneda
   group by d order by d
$$;

-- 3) Ventas por producto (monto sin IVA, por moneda)
create or replace function public.ventas_por_producto(p_desde date, p_hasta date, p_moneda text)
returns table (producto_id bigint, codigo integer, nombre text, unidad text, cantidad numeric, monto numeric, facturas bigint)
language sql stable security invoker
set search_path = public
as $$
  select l.producto_id, max(l.codigo), max(l.descripcion), max(l.unidad), sum(l.cantidad), sum(l.total_linea), count(distinct f.id)
    from public.factura_lineas l join public.facturas f on f.id = l.factura_id
   where f.estado = 'emitida' and f.moneda = p_moneda and f.fecha between p_desde and p_hasta
   group by l.producto_id
   order by sum(l.total_linea) desc
$$;

-- 4) Ventas por cliente
create or replace function public.ventas_por_cliente(p_desde date, p_hasta date, p_moneda text)
returns table (cliente_id bigint, numero integer, nombre text, facturas bigint, total numeric, pagado numeric, saldo numeric)
language sql stable security invoker
set search_path = public
as $$
  select c.id, c.numero, c.nombre, count(*), sum(f.total), sum(f.pagado), sum(f.saldo)
    from public.facturas f join public.clientes c on c.id = f.cliente_id
   where f.estado = 'emitida' and f.moneda = p_moneda and f.fecha between p_desde and p_hasta
   group by c.id
   order by sum(f.total) desc
$$;

-- 5) Compras por proveedor y fruta, con merma
create or replace function public.compras_por_proveedor(p_desde date, p_hasta date)
returns table (proveedor_id bigint, proveedor text, moneda text, rubro text, entregas bigint,
               kg numeric, merma numeric, merma_pct numeric, unidades numeric, total numeric)
language sql stable security invoker
set search_path = public
as $$
  select pr.id, pr.nombre, e.moneda, p.nombre, count(*),
         sum(e.kg_total), sum(e.merma) filter (where e.modo_pesaje <> 'UNIDAD'),
         case when sum(e.kg_total) > 0
              then round(coalesce(sum(e.merma) filter (where e.modo_pesaje <> 'UNIDAD'), 0) * 100 / sum(e.kg_total), 1) end,
         sum(e.unidades), sum(e.total)
    from public.entregas_proveedor e
    join public.proveedores pr on pr.id = e.proveedor_id
    join public.productos p on p.id = e.producto_id
   where e.fecha between p_desde and p_hasta
   group by pr.id, e.moneda, p.id
   order by pr.nombre, e.moneda, p.nombre
$$;

-- 6) Cajas (clientes) y cestas (proveedores): movimiento del rango y pendientes de siempre
create or replace function public.cajas_cestas(p_desde date, p_hasta date)
returns table (tipo text, id bigint, nombre text, salieron bigint, volvieron bigint, pendientes bigint)
language sql stable security invoker
set search_path = public
as $$
  select 'cajas'::text, c.id, c.nombre,
         coalesce(sum(e.retiradas) filter (where e.fecha between p_desde and p_hasta), 0),
         coalesce(sum(e.devueltas) filter (where e.fecha between p_desde and p_hasta), 0),
         coalesce(sum(e.retiradas), 0) - coalesce(sum(e.devueltas), 0)
    from public.empaques_clientes e join public.clientes c on c.id = e.cliente_id
   group by c.id
  having coalesce(sum(e.retiradas), 0) <> coalesce(sum(e.devueltas), 0)
      or count(*) filter (where e.fecha between p_desde and p_hasta) > 0
  union all
  select 'cestas', p.id, p.nombre,
         coalesce(sum(x.entregadas) filter (where x.fecha between p_desde and p_hasta), 0),
         coalesce(sum(x.devueltas) filter (where x.fecha between p_desde and p_hasta), 0),
         coalesce(sum(x.entregadas), 0) - coalesce(sum(x.devueltas), 0)
    from public.cestas_proveedor x join public.proveedores p on p.id = x.proveedor_id
   group by p.id
  having coalesce(sum(x.entregadas), 0) <> coalesce(sum(x.devueltas), 0)
      or count(*) filter (where x.fecha between p_desde and p_hasta) > 0
  order by 1, 6 desc, 3
$$;

-- 7) Rendimiento semanal: lo vendido cada semana (lunes a domingo) en las últimas N semanas,
--    en unidades (bolsas), kg de pulpa y monto de una moneda. Semanas sin ventas = 0.
create or replace function public.ventas_semanales(p_semanas int, p_moneda text, p_hasta date default public.hoy())
returns table (semana date, unidades numeric, kg numeric, total numeric)
language sql stable security invoker
set search_path = public
as $$
  with semanas as (
    select (date_trunc('week', p_hasta) - (i || ' weeks')::interval)::date semana
      from generate_series(0, greatest(least(coalesce(p_semanas, 12), 52), 2) - 1) i),
  lineas as (
    select date_trunc('week', f.fecha)::date semana, sum(l.cantidad) unidades,
           sum(l.cantidad * coalesce(p.peso_kg, case when p.unidad = 'kg' then 1 end)) kg
      from public.factura_lineas l
      join public.facturas f on f.id = l.factura_id
      join public.productos p on p.id = l.producto_id
     where f.estado = 'emitida' and f.fecha >= (select min(semana) from semanas) and f.fecha <= p_hasta
     group by 1),
  montos as (
    select date_trunc('week', fecha)::date semana, sum(total) total
      from public.facturas
     where estado = 'emitida' and moneda = p_moneda and fecha >= (select min(semana) from semanas) and fecha <= p_hasta
     group by 1)
  select s.semana, coalesce(l.unidades, 0), coalesce(l.kg, 0), coalesce(m.total, 0)
    from semanas s left join lineas l using (semana) left join montos m using (semana)
   order by s.semana
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.ventas_semanales(int,text,date)',
    'public.resumen_periodo(date,date)', 'public.ventas_por_dia(date,date,text)',
    'public.ventas_por_producto(date,date,text)', 'public.ventas_por_cliente(date,date,text)',
    'public.compras_por_proveedor(date,date)', 'public.cajas_cestas(date,date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
