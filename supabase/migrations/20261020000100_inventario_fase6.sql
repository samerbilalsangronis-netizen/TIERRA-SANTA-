-- =====================================================================
-- Tierra Santa · Fase 6 · Inventario
-- El inventario es solo de producto terminado: sube con la producción de
-- la planta y baja con facturas, merma y ajustes. Las entregas de
-- proveedores no entran al inventario (decisión de Samer).
-- =====================================================================

-- 1) Stock total: se agrega la categoría para que las alertas ignoren los insumos
create or replace view public.v_stock_total with (security_invoker = true) as
select p.id producto_id, p.codigo, p.nombre, p.emoji, p.unidad, p.tipo, p.stock_minimo, p.activo,
       coalesce(sum(e.cantidad) filter (where e.forma = 'PT'), 0) stock_pt,
       coalesce(sum(e.cantidad) filter (where e.forma = 'MP'), 0) stock_mp,
       case when coalesce(sum(e.cantidad) filter (where e.forma = public.forma_venta(p.id)), 0) <= 0 then 'agotado'
            when coalesce(sum(e.cantidad) filter (where e.forma = public.forma_venta(p.id)), 0) < p.stock_minimo then 'bajo'
            else 'normal' end indicador,
       p.categoria
  from public.productos p
  left join public.existencias e on e.producto_id = p.id
 group by p.id;
grant select on public.v_stock_total to authenticated;

-- 2) Producción por día y producto en un rango (para el resumen diario/semanal)
create or replace function public.produccion_resumen(p_desde date, p_hasta date)
returns table (fecha date, producto_id bigint, codigo integer, nombre text, emoji text, unidad text, cantidad numeric)
language sql stable security invoker
set search_path = public
as $$
  select pr.fecha, p.id, p.codigo, p.nombre, p.emoji, p.unidad, sum(m.cantidad)
    from public.producciones pr
    join public.movimientos_inventario m on m.produccion_id = pr.id and m.tipo = 'produccion'
    join public.productos p on p.id = m.producto_id
   where pr.fecha between p_desde and p_hasta
   group by pr.fecha, p.id
   order by pr.fecha desc, p.codigo
$$;

-- 3) Eliminar un registro de producción equivocado (solo admin): se borran sus
--    movimientos y el stock vuelve a como estaba. Queda en la auditoría.
create or replace function public.eliminar_produccion(p_id bigint, p_motivo text)
returns void language plpgsql security definer
set search_path = public
as $$
declare v_antes jsonb;
begin
  perform public.exigir_rol('admin');
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indique el motivo.'; end if;
  select to_jsonb(pr) || jsonb_build_object('items',
           (select jsonb_agg(jsonb_build_object('producto_id', m.producto_id, 'cantidad', m.cantidad))
              from public.movimientos_inventario m where m.produccion_id = pr.id))
    into v_antes from public.producciones pr where pr.id = p_id;
  if v_antes is null then raise exception 'Producción no encontrada.'; end if;
  delete from public.movimientos_inventario where produccion_id = p_id;
  delete from public.producciones where id = p_id;
  perform public.auditar('BORRAR', 'producciones', p_id::text, v_antes, null, p_motivo);
end $$;

-- 4) Merma con motivo obligatorio
create or replace function public.registrar_merma_inventario(
  p_producto_id bigint, p_ubicacion_id bigint, p_forma public.forma_inventario,
  p_cantidad numeric, p_motivo text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public.exigir_rol('admin', 'operador', 'facturacion');
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a 0.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indique el motivo de la merma.'; end if;
  perform public.inv_salida(p_producto_id, p_ubicacion_id, p_forma, p_cantidad, 'merma', p_nota => trim(p_motivo));
end $$;

revoke execute on function public.produccion_resumen(date, date) from public, anon;
revoke execute on function public.eliminar_produccion(bigint, text) from public, anon;
revoke execute on function public.registrar_merma_inventario(bigint, bigint, public.forma_inventario, numeric, text) from public, anon;
grant execute on function public.produccion_resumen(date, date) to authenticated;
grant execute on function public.eliminar_produccion(bigint, text) to authenticated;
grant execute on function public.registrar_merma_inventario(bigint, bigint, public.forma_inventario, numeric, text) to authenticated;
