-- =====================================================================
-- Tierra Santa · Fruta comprada ≠ producto vendido (pedido de Samer)
--
-- Cada fruta que hoy es "ambos" se separa en:
--   · la fruta que se compra al proveedor  → tipo materia_prima, código 900 + código
--     (solo aparece en las entregas de proveedores; conserva sus entregas)
--   · "<Fruta> 800 g"                     → tipo terminado, unidad bolsa, CONSERVA el código
--     (el que se teclea al facturar: 1 = Guanábana 800 g)
--   · "<Fruta> 1 kg"                      → tipo terminado, unidad bolsa, código 100 + código
-- Las facturas, la producción y los movimientos de inventario que ya existían
-- con la fruta pasan a la presentación de 800 g.
-- Si un código destino ya está ocupado se usa el siguiente libre.
-- =====================================================================

do $$
declare
  r record; v_cod_fruta int; v_cod_1kg int; v_id800 bigint; v_id1kg bigint;

begin
  -- Se recalculan las existencias al final; el trigger impide editar movimientos
  alter table public.movimientos_inventario disable trigger movimientos_existencias;

  for r in
    select * from public.productos
     where categoria = 'fruta' and tipo = 'ambos'
     order by codigo
  loop
    -- 1) La fruta comprada libera su código y pasa a 900 + código
    v_cod_fruta := 900 + r.codigo;
    while exists (select 1 from public.productos where codigo = v_cod_fruta) loop v_cod_fruta := v_cod_fruta + 1; end loop;
    update public.productos set codigo = v_cod_fruta, tipo = 'materia_prima', stock_minimo = 0 where id = r.id;

    -- 2) Bolsa de 800 g con el código de siempre
    insert into public.productos (codigo, nombre, emoji, unidad, tipo, categoria, modo_pesaje, stock_minimo, activo, notas)
    values (r.codigo, r.nombre || ' 800 g', r.emoji, 'bolsa', 'terminado', 'fruta', 'UNIDAD', r.stock_minimo, r.activo,
            'Presentación de 800 g')
    returning id into v_id800;

    -- 3) Bolsa de 1 kg con código 100 + código
    v_cod_1kg := 100 + r.codigo;
    while exists (select 1 from public.productos where codigo = v_cod_1kg) loop v_cod_1kg := v_cod_1kg + 1; end loop;
    insert into public.productos (codigo, nombre, emoji, unidad, tipo, categoria, modo_pesaje, stock_minimo, activo, notas)
    values (v_cod_1kg, r.nombre || ' 1 kg', r.emoji, 'bolsa', 'terminado', 'fruta', 'UNIDAD', 0, r.activo,
            'Presentación de 1 kg')
    returning id into v_id1kg;

    -- 4) Lo vendido / producido con la fruta pasa a la bolsa de 800 g
    update public.factura_lineas
       set producto_id = v_id800, codigo = r.codigo, descripcion = r.nombre || ' 800 g', unidad = 'bolsa'
     where producto_id = r.id;
    update public.movimientos_inventario set producto_id = v_id800
     where producto_id = r.id and forma = 'PT';

    update public.lotes set producto_id = v_id800
     where producto_id = r.id
       and not exists (select 1 from public.lotes l2 where l2.producto_id = v_id800 and l2.codigo = public.lotes.codigo);
  end loop;

  -- 5) Existencias recalculadas desde el libro mayor
  delete from public.existencias;
  insert into public.existencias (producto_id, ubicacion_id, forma, lote_id, cantidad)
  select producto_id, ubicacion_id, forma, lote_id, sum(cantidad)
    from public.movimientos_inventario
   group by producto_id, ubicacion_id, forma, lote_id
  having sum(cantidad) <> 0;

  alter table public.movimientos_inventario enable trigger movimientos_existencias;
end $$;
