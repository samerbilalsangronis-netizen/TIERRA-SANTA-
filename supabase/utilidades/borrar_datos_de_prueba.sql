-- =====================================================================
-- Tierra Santa · BORRAR LOS DATOS DE PRUEBA (no se puede deshacer)
--
-- Uso: Supabase → SQL Editor → New query → pegar todo → Run.
-- Recomendado antes: Configuración → General → "Descargar respaldo en Excel".
--
-- BORRA: clientes, facturas, pagos, cajas · proveedores, entregas, abonos,
--        cestas · inventario (producción, movimientos, stock, lotes) ·
--        nómina (empleados, jornadas, abonos, periodos) · bitácora.
--        Los contadores (nº de factura, recibo y cliente) vuelven a empezar.
-- QUEDA: usuarios, datos de la empresa y logo, catálogos (productos,
--        unidades, ubicaciones, monedas y tasas, métodos de pago, tareas).
--
-- Los archivos subidos (fotos de entregas y soportes de facturas) quedan en
-- Storage sin uso; se pueden borrar a mano en Supabase → Storage.
-- No es una migración: no está en supabase/migrations ni en instalar.sql.
-- =====================================================================
begin;

truncate table
  public.pago_aplicaciones, public.pagos_clientes,
  public.factura_versiones, public.factura_lineas, public.empaques_clientes,
  public.movimientos_inventario, public.existencias, public.lotes, public.producciones,
  public.facturas, public.clientes,
  public.cestas_proveedor, public.abonos_proveedor, public.entregas_proveedor, public.proveedores,
  public.jornada_tareas, public.jornadas, public.abonos_empleados,
  public.periodo_nomina_items, public.periodos_nomina, public.empleados,
  public.audit_log
restart identity;

update public.contadores set valor = 0
 where clave in ('factura', 'recibo_cliente', 'recibo_proveedor', 'cliente');

-- Queda constancia del borrado en la bitácora nueva
insert into public.audit_log (usuario, accion, tabla, nota)
values ('sistema', 'BORRAR', 'datos_de_prueba', 'Se borraron los datos de prueba antes de migrar los registros reales');

commit;

-- Comprobación: todo debe salir en 0
select (select count(*) from public.clientes) clientes, (select count(*) from public.facturas) facturas,
       (select count(*) from public.proveedores) proveedores, (select count(*) from public.empleados) empleados,
       (select count(*) from public.movimientos_inventario) movimientos,
       (select count(*) from public.productos) productos_que_quedan;
