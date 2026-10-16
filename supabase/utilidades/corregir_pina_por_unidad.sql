-- =====================================================================
-- Tierra Santa · Piña importada por kilo → por unidad (una sola vez)
--
-- En la hoja anterior la columna "KG TOTAL" de la piña eran unidades.
-- La migración de proveedores COP la guardó como kilos con precio total;
-- esto la pasa a "por unidad": unidades = esos "kg", precio por unidad =
-- precio total / unidades. El total de cada entrega (y el saldo) no cambia.
--
-- Uso: Supabase → SQL Editor → New query → pegar todo → Run.
-- Si algún total cambiara en más de 1, da error y no se guarda nada.
-- =====================================================================
do $$
declare v_antes numeric; v_despues numeric; n int;
begin
  select coalesce(sum(e.total), 0) into v_antes
    from public.entregas_proveedor e join public.productos p on p.id = e.producto_id
   where public.normalizar(p.nombre) = 'pina';

  update public.entregas_proveedor e
     set modo_pesaje = 'UNIDAD', unidades = e.kg_total,
         precio = round(e.precio / e.kg_total, 2), kg_total = 0
    from public.productos p
   where p.id = e.producto_id and public.normalizar(p.nombre) = 'pina'
     and e.modo_pesaje = 'VARIABLE' and e.kg_total > 0;
  get diagnostics n = row_count;

  select coalesce(sum(e.total), 0) into v_despues
    from public.entregas_proveedor e join public.productos p on p.id = e.producto_id
   where public.normalizar(p.nombre) = 'pina';

  if abs(v_antes - v_despues) > 1 then
    raise exception 'El total cambiaría (antes %, después %); no se guardó nada', v_antes, v_despues;
  end if;
  raise notice 'Entregas de piña corregidas: % (total % sin cambios)', n, v_antes;
end $$;

-- Resultado: la piña ahora va por unidad
select e.fecha, p.nombre, e.modo_pesaje, e.unidades, e.precio, e.total
  from public.entregas_proveedor e join public.productos p on p.id = e.producto_id
 where public.normalizar(p.nombre) = 'pina' order by e.fecha;
