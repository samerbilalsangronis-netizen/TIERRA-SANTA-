-- =====================================================================
-- Tierra Santa · 0009 · Seguridad: Row Level Security en todas las tablas,
-- funciones de negocio como SECURITY DEFINER (con verificación de rol
-- dentro) y revocación de helpers internos.
--
-- Matriz de permisos (por defecto):
--   admin        → todo
--   facturacion  → clientes, facturas, cobros, proveedores, inventario (sin ajustes)
--   operador     → proveedores (entregas, cestas), inventario (producción, traslados, merma)
--   solo_lectura → solo consulta (sin nómina ni auditoría)
--   Nómina y auditoría → solo admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de negocio: se ejecutan con privilegios del dueño, pero cada
-- una valida el rol del usuario con exigir_rol()/puede_editar_facturas().
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.siguiente_numero(text)',
    'public.siguiente_numero_factura()',
    'public.tg_cliente_numero()',
    'public.tg_jornada_tareas_total()',
    'public.tg_aplicacion_pagado()',
    'public.registrar_produccion(date,bigint,jsonb,text,text)',
    'public.trasladar_inventario(bigint,public.forma_inventario,bigint,bigint,numeric,text)',
    'public.ajustar_inventario(bigint,bigint,public.forma_inventario,numeric,text)',
    'public.registrar_merma_inventario(bigint,bigint,public.forma_inventario,numeric,text)',
    'public.guardar_jornada(jsonb)',
    'public.cerrar_periodo_nomina(bigint,boolean,text)',
    'public.reabrir_periodo_nomina(bigint,text)',
    'public.guardar_borrador_factura(jsonb)',
    'public.emitir_factura(jsonb)',
    'public.editar_factura(jsonb)',
    'public.anular_factura(bigint,text)',
    'public.registrar_factura_externa(jsonb)',
    'public.registrar_pago_cliente(jsonb)',
    'public.editar_pago_cliente(bigint,jsonb)',
    'public.eliminar_pago_cliente(bigint)',
    'public.aplicar_saldo_a_favor(bigint,numeric)'
  ] loop
    execute format('alter function %s security definer set search_path = public, extensions', f);
  end loop;
end $$;

-- Nadie anónimo ejecuta funciones del esquema público...
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ...y los helpers internos solo se usan desde otras funciones
do $$
declare f text;
begin
  foreach f in array array[
    'public.siguiente_numero_factura()',
    'public.inv_salida(bigint,bigint,public.forma_inventario,numeric,public.tipo_movimiento,timestamptz,bigint,bigint,bigint,uuid,text)',
    'public.inv_ajustar_factura(bigint,bigint,bigint,numeric,text)',
    'public.factura_guardar_lineas(bigint,jsonb)',
    'public.factura_sincronizar_inventario(bigint)',
    'public.factura_liberar_exceso(bigint)',
    'public.factura_aplicar_cabecera(bigint,jsonb)',
    'public.factura_copiar_cliente(bigint)',
    'public.registrar_version_factura(bigint,text,jsonb,text)',
    'public.recalcular_pagado(bigint)',
    'public.auditar(text,text,text,jsonb,jsonb,text)'
  ] loop
    execute format('revoke execute on function %s from authenticated', f);
  end loop;
end $$;

-- Datos mínimos de la empresa para la pantalla de inicio (sin sesión)
create or replace function public.empresa_publica()
returns table (razon_social text, logo_path text)
language sql stable security definer set search_path = public
as $$ select razon_social, logo_path from public.empresa where id = 1 $$;
grant execute on function public.empresa_publica() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Habilitar RLS en todas las tablas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Helper para generar políticas estándar
-- lectura: cualquier usuario activo (o solo admin) · escritura: roles indicados
create or replace function public._politicas(
  p_tabla text, p_lectura text, p_insert text, p_update text, p_delete text)
returns void language plpgsql
as $$
begin
  if p_lectura is not null then
    execute format('create policy %I on public.%I for select to authenticated using (%s)', p_tabla || '_select', p_tabla, p_lectura);
  end if;
  if p_insert is not null then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_tabla || '_insert', p_tabla, p_insert);
  end if;
  if p_update is not null then
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_tabla || '_update', p_tabla, p_update, p_update);
  end if;
  if p_delete is not null then
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', p_tabla || '_delete', p_tabla, p_delete);
  end if;
end $$;

do $$
begin
-- Perfiles: cada uno ve el suyo; admin ve y edita todos
perform public._politicas('profiles', 'id = auth.uid() or public.es_admin()', null,
                         '(id = auth.uid() and public.es_usuario_activo()) or public.es_admin()', null);
-- Auditoría: solo admin lee; se escribe por funciones
perform public._politicas('audit_log', 'public.es_admin()', null, null, null);

-- Configuración
perform public._politicas('empresa', 'public.es_usuario_activo()', null, 'public.es_admin()', null);
perform public._politicas('contadores', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('monedas', 'public.es_usuario_activo()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('tasas_cambio', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion')$p$, 'public.es_admin()', 'public.es_admin()');
perform public._politicas('unidades', 'public.es_usuario_activo()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('ubicaciones', 'public.es_usuario_activo()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('productos', 'public.es_usuario_activo()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('metodos_pago', 'public.es_usuario_activo()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');

-- Clientes y facturación (facturas/pagos solo se escriben vía funciones)
perform public._politicas('clientes', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion')$p$, $p$public.tiene_rol('admin','facturacion')$p$, 'public.es_admin()');
perform public._politicas('facturas', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('factura_lineas', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('factura_versiones', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('pagos_clientes', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('pago_aplicaciones', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('empaques_clientes', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion')$p$, $p$public.tiene_rol('admin','facturacion')$p$,
  $p$public.tiene_rol('admin','facturacion')$p$);

-- Proveedores
perform public._politicas('proveedores', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion','operador')$p$, $p$public.tiene_rol('admin','facturacion','operador')$p$,
  'public.es_admin()');
perform public._politicas('entregas_proveedor', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion','operador')$p$, $p$public.tiene_rol('admin','facturacion','operador')$p$,
  $p$public.tiene_rol('admin','facturacion')$p$);
perform public._politicas('abonos_proveedor', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion')$p$, $p$public.tiene_rol('admin','facturacion')$p$,
  $p$public.tiene_rol('admin','facturacion')$p$);
perform public._politicas('cestas_proveedor', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion','operador')$p$, $p$public.tiene_rol('admin','facturacion','operador')$p$,
  $p$public.tiene_rol('admin','facturacion')$p$);

-- Inventario (movimientos solo por funciones/triggers)
perform public._politicas('lotes', 'public.es_usuario_activo()',
  $p$public.tiene_rol('admin','facturacion','operador')$p$, $p$public.tiene_rol('admin','facturacion','operador')$p$,
  'public.es_admin()');
perform public._politicas('producciones', 'public.es_usuario_activo()', null, 'public.es_admin()', 'public.es_admin()');
perform public._politicas('movimientos_inventario', 'public.es_usuario_activo()', null, null, null);
perform public._politicas('existencias', 'public.es_usuario_activo()', null, null, null);

-- Nómina: solo admin
perform public._politicas('empleados', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('tareas_nomina', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('jornadas', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('jornada_tareas', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('abonos_empleados', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('periodos_nomina', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()', 'public.es_admin()');
perform public._politicas('periodo_nomina_items', 'public.es_admin()', null, null, null);
end $$;

drop function public._politicas(text, text, text, text, text);

-- Las vistas heredan el RLS de las tablas (security_invoker); se da lectura.
grant select on public.v_saldos_clientes_moneda, public.v_resumen_clientes,
                public.v_saldos_proveedores_moneda, public.v_resumen_proveedores,
                public.v_stock, public.v_stock_total, public.v_resumen_empleados
  to authenticated;
