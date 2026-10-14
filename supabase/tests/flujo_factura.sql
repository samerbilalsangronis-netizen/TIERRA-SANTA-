-- Prueba de extremo a extremo (SQL) del flujo factura → inventario → cuenta por cobrar.
-- Se ejecuta sobre una BD con shim_supabase.sql + migraciones. Falla con excepción si algo no cuadra.
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@usuarios.tierrasanta.local', '{"usuario":"admin","nombre":"Admin","rol":"admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'ventas@usuarios.tierrasanta.local', '{"usuario":"ventas","nombre":"Ventas","rol":"facturacion"}'),
  ('00000000-0000-0000-0000-000000000003', 'lector@usuarios.tierrasanta.local', '{"usuario":"lector","nombre":"Lector","rol":"solo_lectura"}');

create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'PRUEBA FALLIDA: %', msg; end if; raise notice 'ok: %', msg; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

-- Cliente y producción
insert into public.clientes (nombre, documento) values ('Carlos Roa', 'V-12345678');
select pg_temp.check((select numero from public.clientes where nombre = 'Carlos Roa') = 1, 'cliente numerado automáticamente');
select public.registrar_produccion(public.hoy(), public.ubicacion_predeterminada(),
  '[{"producto_id":1,"cantidad":500},{"producto_id":2,"cantidad":100}]'::jsonb, 'Samer', 'Prueba');
select pg_temp.check(public.stock_disponible(1) = 500, 'producción suma stock');

-- Emitir factura 1: 400 guanábana a 2,50 con IVA + 50 parchita a 3 sin IVA
select public.emitir_factura(jsonb_build_object(
  'cliente_id', (select id from public.clientes where numero = 1), 'moneda', 'USD',
  'lineas', '[{"producto_id":1,"cantidad":400,"precio_unitario":2.5,"aplica_iva":true},
              {"producto_id":2,"cantidad":50,"precio_unitario":3,"aplica_iva":false}]'::jsonb,
  'empaques', '{"retiradas":10}'::jsonb)) as r1 \gset
select pg_temp.check((select numero from public.facturas where id = (:'r1'::jsonb->>'id')::bigint) = 1, 'número 1 asignado');
select pg_temp.check((select total from public.facturas where numero = 1) = 1310.00, 'total con IVA 16% = 1000+160+150');
select pg_temp.check(public.stock_disponible(1) = 100, 'inventario descontado (500-400)');
select pg_temp.check((select saldo_usd from public.v_resumen_clientes where numero = 1) = 1310, 'saldo USD del cliente');
select pg_temp.check((select cajas_pendientes from public.v_resumen_clientes where numero = 1) = 10, 'cajas pendientes');

-- Factura 2 y 3
select public.emitir_factura(jsonb_build_object('cliente_id', 1, 'moneda', 'USD',
  'lineas', '[{"producto_id":2,"cantidad":10,"precio_unitario":100}]'::jsonb));
select public.emitir_factura(jsonb_build_object('cliente_id', 1, 'moneda', 'USD',
  'lineas', '[{"producto_id":2,"cantidad":10,"precio_unitario":150}]'::jsonb));
-- Pago múltiple: 1 completa, 2 completa, 3 solo 900 de 1500
select public.registrar_pago_cliente(jsonb_build_object('cliente_id', 1, 'moneda', 'USD', 'monto', 3310,
  'aplicaciones', jsonb_build_array(
    jsonb_build_object('factura_id', (select id from public.facturas where numero = 1), 'monto', 1310),
    jsonb_build_object('factura_id', (select id from public.facturas where numero = 2), 'monto', 1000),
    jsonb_build_object('factura_id', (select id from public.facturas where numero = 3), 'monto', 900))));
select pg_temp.check((select estado_pago from public.facturas where numero = 1) = 'pagada', 'factura 1 pagada');
select pg_temp.check((select estado_pago from public.facturas where numero = 3) = 'abonada', 'factura 3 abonada');
select pg_temp.check((select saldo_usd from public.v_resumen_clientes where numero = 1) = 500, 'saldo = 600 pendiente - 100 a favor');
select pg_temp.check(public.saldo_a_favor(1, 'USD') = 100, 'saldo a favor 100');

-- Editar factura 1: 450 guanábanas → descuenta 50 más
select public.editar_factura(jsonb_build_object('id', (select id from public.facturas where numero = 1), 'motivo', 'más fruta',
  'lineas', '[{"producto_id":1,"cantidad":450,"precio_unitario":2.5,"aplica_iva":true},
              {"producto_id":2,"cantidad":50,"precio_unitario":3,"aplica_iva":false}]'::jsonb));
select pg_temp.check(public.stock_disponible(1) = 50, 'edición descuenta la diferencia');
select pg_temp.check((select total from public.facturas where numero = 1) = 1455.00, 'nuevo total 1125+180+150');
select pg_temp.check((select estado_pago from public.facturas where numero = 1) = 'abonada', 'factura 1 vuelve a abonada');
select pg_temp.check((select count(*) from public.factura_versiones where factura_id = (select id from public.facturas where numero = 1)) = 2, 'versión registrada');

-- Editar bajando total por debajo de lo pagado → exceso a saldo a favor
select public.editar_factura(jsonb_build_object('id', (select id from public.facturas where numero = 2),
  'lineas', '[{"producto_id":2,"cantidad":5,"precio_unitario":100}]'::jsonb)) as r2 \gset
select pg_temp.check((:'r2'::jsonb->>'saldo_a_favor_generado')::numeric = 500, 'exceso liberado 500');
select pg_temp.check(public.saldo_a_favor(1, 'USD') = 600, 'saldo a favor 600');

-- Aplicar saldo a favor a la factura 3 (le faltan 600)
select public.aplicar_saldo_a_favor((select id from public.facturas where numero = 3), null);
select pg_temp.check((select estado_pago from public.facturas where numero = 3) = 'pagada', 'factura 3 pagada con saldo a favor');

-- Cambio de moneda USD → COP con pagos (tasa 4000)
select public.editar_factura(jsonb_build_object('id', (select id from public.facturas where numero = 3),
  'moneda', 'COP', 'tasa_conversion', 4000,
  'lineas', '[{"producto_id":2,"cantidad":10,"precio_unitario":600000}]'::jsonb));
select pg_temp.check((select pagado from public.facturas where numero = 3) = 6000000, 'pagos convertidos a COP');
select pg_temp.check((select saldo_cop from public.v_resumen_clientes where numero = 1) = 0, 'saldo COP 0');
select pg_temp.check((select saldo_usd from public.v_resumen_clientes where numero = 1) = 145, 'saldo USD = 145 pendiente fact 1 - 0 a favor');

-- Anular factura 1 → devuelve inventario y deja pagos como saldo a favor
select public.anular_factura((select id from public.facturas where numero = 1), 'Prueba');
select pg_temp.check(public.stock_disponible(1) = 500, 'anulación devuelve inventario');
select pg_temp.check((select saldo_usd from public.v_resumen_clientes where numero = 1) = -1310, 'pagos quedan a favor');

-- Numeración sin huecos aunque falle una emisión
do $$ begin
  perform public.emitir_factura(jsonb_build_object('cliente_id', 1, 'moneda', 'USD', 'lineas', '[]'::jsonb));
exception when others then null; end $$;
select public.emitir_factura(jsonb_build_object('cliente_id', 1, 'moneda', 'USD',
  'lineas', '[{"producto_id":1,"cantidad":1,"precio_unitario":1}]'::jsonb));
select pg_temp.check((select max(numero) from public.facturas) = 4, 'sin huecos tras error');

-- Proveedores: FIJO y VARIABLE
insert into public.proveedores (nombre) values ('Finca El Topo');
insert into public.entregas_proveedor (proveedor_id, producto_id, moneda, cestas, precio, merma)
  values (1, 1, 'COP', 10, 60000, 5);   -- 20 kg/cesta → 200 kg, precio_kg 3000, desc 15000, total 585000
select pg_temp.check((select total from public.entregas_proveedor where id = 1) = 585000, 'entrega FIJO total');
select pg_temp.check((select peso_neto from public.entregas_proveedor where id = 1) = 195, 'peso neto FIJO');
insert into public.entregas_proveedor (proveedor_id, producto_id, moneda, kg_total, precio, merma)
  values (1, 6, 'USD', 80, 40, 4);      -- precio_kg 0.5, desc 2, total 38
select pg_temp.check((select total from public.entregas_proveedor where id = 2) = 38, 'entrega VARIABLE total');
insert into public.abonos_proveedor (proveedor_id, moneda, monto) values (1, 'COP', 85000);
select pg_temp.check((select saldo_cop from public.v_resumen_proveedores where id = 1) = 500000, 'saldo proveedor COP');

-- Nómina
insert into public.empleados (nombre, tipo, tarifa_dia) values ('Alejandro', 'fijo', 40000), ('Greismar', 'destajo', 0);
select public.guardar_jornada('{"empleado_id":1,"fecha":"2026-10-07","estado":"media"}');
select public.guardar_jornada(jsonb_build_object('empleado_id', 2, 'fecha', '2026-10-02', 'estado', 'asistio',
  'tareas', jsonb_build_array(jsonb_build_object('tarea_id', (select id from public.tareas_nomina where nombre = 'Cortada de Durazno'), 'cantidad', 3))));
select pg_temp.check((select ganado from public.jornadas where empleado_id = 1) = 20000, 'media jornada fijo');
select pg_temp.check((select ganado from public.jornadas where empleado_id = 2) = 30000, 'destajo 3 × 10.000');

-- Permisos: solo lectura no puede emitir ni ver nómina
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$ begin
  perform public.emitir_factura('{"cliente_id":1,"moneda":"USD","lineas":[{"producto_id":1,"cantidad":1,"precio_unitario":1}]}');
  raise exception 'PRUEBA FALLIDA: solo_lectura emitió';
exception when insufficient_privilege then raise notice 'ok: solo_lectura no emite'; end $$;
select pg_temp.check((select count(*) from public.empleados) = 0, 'solo_lectura no ve nómina');
select pg_temp.check((select count(*) from public.clientes) = 1, 'solo_lectura ve clientes');
do $$ begin
  insert into public.clientes (nombre) values ('x');
  raise exception 'PRUEBA FALLIDA: solo_lectura insertó';
exception when insufficient_privilege then raise notice 'ok: solo_lectura no inserta'; end $$;
reset role;
select 'TODAS LAS PRUEBAS PASARON' as resultado;
