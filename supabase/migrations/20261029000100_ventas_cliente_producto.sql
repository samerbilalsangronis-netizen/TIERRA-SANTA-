-- =====================================================================
-- Tierra Santa · Reporte "Ventas a un cliente por producto"
--
-- Lo que se llevó un cliente en un periodo, sumado por producto y moneda
-- (p. ej. cargó tres veces en la semana: 500 bolsas de mora y 200 de fresa).
-- Solo facturas emitidas con detalle; las históricas importadas no tienen
-- productos y cuentan solo en el total de facturas.
-- =====================================================================
create or replace function public.ventas_cliente_por_producto(p_cliente_id bigint, p_desde date, p_hasta date)
returns table (producto_id bigint, codigo integer, nombre text, unidad text, moneda text,
               cantidad numeric, monto numeric, facturas bigint)
language sql stable security invoker
set search_path = public
as $$
  select l.producto_id, max(l.codigo), max(l.descripcion), max(l.unidad), f.moneda,
         sum(l.cantidad), sum(l.total_linea), count(distinct f.id)
    from public.factura_lineas l join public.facturas f on f.id = l.factura_id
   where f.estado = 'emitida' and f.cliente_id = p_cliente_id and f.fecha between p_desde and p_hasta
   group by l.producto_id, f.moneda
   order by sum(l.cantidad) desc
$$;
revoke execute on function public.ventas_cliente_por_producto(bigint, date, date) from public, anon;
grant execute on function public.ventas_cliente_por_producto(bigint, date, date) to authenticated;
