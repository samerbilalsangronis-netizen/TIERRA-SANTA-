-- =====================================================================
-- Tierra Santa · ¿Qué migraciones están pegadas en esta base de datos?
-- Solo lee, no cambia nada. Supabase → SQL Editor → New query → Run.
-- Cada fila dice ✅ pegada o ❌ FALTA. Al agregar una migración nueva,
-- agregar aquí su fila (algo que solo exista si se aplicó).
-- =====================================================================
select m.archivo, case when m.ok then '✅ pegada' else '❌ FALTA' end as estado
from (values
  ('20261019000100_facturacion_fase5.sql',        to_regprocedure('public.totales_facturas(text,text,text,date,date,bigint)') is not null),
  ('20261020000100_inventario_fase6.sql',         to_regproc('public.produccion_resumen') is not null),
  ('20261021000100_presentaciones_800g_1kg.sql',  exists (select 1 from public.productos where codigo > 900 and tipo = 'materia_prima')),
  ('20261022000100_pulpa_por_fruta.sql',          exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'productos' and column_name = 'fruta_id')),
  ('20261023000100_nomina_fase7.sql',             to_regproc('public.nomina_resumen') is not null),
  ('20261024000100_dashboard_reportes.sql',       to_regproc('public.resumen_periodo') is not null),
  ('20261025000100_una_sola_ubicacion.sql',       (select count(*) from public.ubicaciones where activa) = 1),
  ('20261026000100_cestas_o_kilos.sql',           (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'entregas_proveedor' and column_name = 'cestas') = 4),
  ('20261027000100_fruta_recibida.sql',           to_regproc('public.fruta_recibida') is not null),
  ('20261028000100_inventario_desde.sql',         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'empresa' and column_name = 'inventario_desde')),
  ('20261029000100_ventas_cliente_producto.sql',  to_regproc('public.ventas_cliente_por_producto') is not null),
  ('20261030000100_gastos.sql',                   to_regclass('public.gastos') is not null)
) m(archivo, ok)
order by m.archivo;
