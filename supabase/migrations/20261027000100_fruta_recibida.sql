-- =====================================================================
-- Tierra Santa · Reporte "Fruta recibida"
--
-- Cuánta fruta llegó de los proveedores en un periodo, por fruta: kilos
-- recibidos, merma, kilos netos, cestas y unidades (piña). Se arma con las
-- entregas de los proveedores (cada entrega que se registra se va sumando).
-- Opcional: solo un proveedor.
-- =====================================================================
create or replace function public.fruta_recibida(
  p_desde date, p_hasta date, p_proveedor_id bigint default null)
returns table (producto_id bigint, rubro text, emoji text, entregas bigint, proveedores bigint,
               kg numeric, merma numeric, kg_neto numeric, cestas numeric, unidades numeric)
language sql stable security invoker
set search_path = public
as $$
  select p.id, p.nombre, p.emoji, count(*), count(distinct e.proveedor_id),
         sum(e.kg_total),
         coalesce(sum(e.merma) filter (where e.modo_pesaje <> 'UNIDAD'), 0),
         sum(e.peso_neto),
         sum(e.cestas),
         sum(e.unidades)
    from public.entregas_proveedor e
    join public.productos p on p.id = e.producto_id
   where e.fecha between p_desde and p_hasta
     and p.categoria = 'fruta'
     and (p_proveedor_id is null or e.proveedor_id = p_proveedor_id)
   group by p.id
   order by sum(e.peso_neto) desc, p.nombre
$$;
revoke execute on function public.fruta_recibida(date, date, bigint) from public, anon;
grant execute on function public.fruta_recibida(date, date, bigint) to authenticated;
