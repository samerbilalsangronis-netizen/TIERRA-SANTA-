-- =====================================================================
-- Tierra Santa · Una sola ubicación (pedido de Samer: "por ahora no hace falta")
-- Todo el stock pasa a la ubicación principal (queda como traslado en el
-- kardex) y las demás ubicaciones se desactivan. Si algún día se necesitan,
-- se vuelven a activar en Configuración → Catálogos → Ubicaciones y las
-- pantallas muestran otra vez la ubicación.
-- =====================================================================
do $$
declare v_def bigint; r record; v_tid uuid;
begin
  select id into v_def from public.ubicaciones where predeterminada order by id limit 1;
  if v_def is null then
    select id into v_def from public.ubicaciones order by activa desc, id limit 1;
    update public.ubicaciones set predeterminada = true where id = v_def;
  end if;
  update public.ubicaciones set activa = true where id = v_def;

  for r in
    select producto_id, ubicacion_id, forma, lote_id, cantidad
      from public.existencias where ubicacion_id <> v_def and cantidad <> 0
  loop
    v_tid := gen_random_uuid();
    insert into public.movimientos_inventario (producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, traslado_id, nota) values
      (r.producto_id, r.ubicacion_id, r.forma, 'traslado_salida', -r.cantidad, r.lote_id, v_tid, 'Todo el stock pasa a la ubicación principal'),
      (r.producto_id, v_def, r.forma, 'traslado_entrada', r.cantidad, r.lote_id, v_tid, 'Todo el stock pasa a la ubicación principal');
  end loop;

  update public.ubicaciones set activa = false where id <> v_def;
  update public.facturas set ubicacion_id = v_def where estado = 'borrador' and ubicacion_id is distinct from v_def;
end $$;
