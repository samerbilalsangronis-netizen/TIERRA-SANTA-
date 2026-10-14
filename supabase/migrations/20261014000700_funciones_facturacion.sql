-- =====================================================================
-- Tierra Santa · 0007 · Funciones transaccionales de facturación y cobros:
-- guardar borrador, emitir, editar (con versiones, ajuste de inventario y
-- cambio de moneda), anular, registrar/editar/eliminar pagos, aplicar
-- saldo a favor.
-- Todas corren en una sola transacción: si algo falla, no se guarda nada.
-- =====================================================================

-- Siguiente nº de factura (sin huecos: el contador se bloquea hasta el COMMIT)
create or replace function public.siguiente_numero_factura()
returns bigint language plpgsql
as $$
declare v bigint; v_ini bigint;
begin
  select factura_numero_inicial into v_ini from public.empresa where id = 1;
  select valor + 1 into v from public.contadores where clave = 'factura' for update;
  if v < v_ini then v := v_ini; end if;
  update public.contadores set valor = v where clave = 'factura';
  return v;
end $$;

-- ¿El usuario actual puede editar facturas emitidas?
create or replace function public.puede_editar_facturas()
returns boolean language sql stable
as $$ select coalesce(public.rol_actual() = any(roles_editan_factura), false) from public.empresa where id = 1 $$;

-- Instantánea completa de una factura (cabecera + líneas)
create or replace function public.factura_snapshot(p_id bigint)
returns jsonb language sql stable
as $$
  select to_jsonb(f) - 'search' || jsonb_build_object('lineas',
           coalesce((select jsonb_agg(to_jsonb(l) - 'factura_id' order by l.orden, l.id)
                       from public.factura_lineas l where l.factura_id = f.id), '[]'::jsonb))
    from public.facturas f where f.id = p_id
$$;

-- Diferencias entre dos instantáneas (para el historial de versiones)
create or replace function public.factura_diferencias(p_antes jsonb, p_despues jsonb)
returns jsonb language plpgsql immutable
as $$
declare k text; v_res jsonb := '{}'::jsonb;
  v_campos text[] := array['cliente_id', 'cliente_nombre', 'fecha', 'moneda', 'condicion', 'ubicacion_id',
                           'observaciones', 'iva_pct', 'subtotal', 'iva', 'total', 'estado'];
  v_la jsonb; v_ld jsonb;
begin
  foreach k in array v_campos loop
    if (p_antes->k) is distinct from (p_despues->k) then
      v_res := v_res || jsonb_build_object(k, jsonb_build_object('antes', p_antes->k, 'despues', p_despues->k));
    end if;
  end loop;
  select jsonb_agg(jsonb_build_object('codigo', l->'codigo', 'descripcion', l->'descripcion', 'cantidad', l->'cantidad',
                                      'precio_unitario', l->'precio_unitario', 'aplica_iva', l->'aplica_iva'))
    into v_la from jsonb_array_elements(coalesce(p_antes->'lineas', '[]'::jsonb)) l;
  select jsonb_agg(jsonb_build_object('codigo', l->'codigo', 'descripcion', l->'descripcion', 'cantidad', l->'cantidad',
                                      'precio_unitario', l->'precio_unitario', 'aplica_iva', l->'aplica_iva'))
    into v_ld from jsonb_array_elements(coalesce(p_despues->'lineas', '[]'::jsonb)) l;
  if v_la is distinct from v_ld then
    v_res := v_res || jsonb_build_object('lineas', jsonb_build_object('antes', v_la, 'despues', v_ld));
  end if;
  return v_res;
end $$;

create or replace function public.registrar_version_factura(p_id bigint, p_accion text, p_antes jsonb, p_motivo text)
returns void language plpgsql
as $$
declare v_snap jsonb; v_ver int;
begin
  update public.facturas set version = version + 1 where id = p_id returning version into v_ver;
  v_snap := public.factura_snapshot(p_id);
  insert into public.factura_versiones (factura_id, version, accion, snapshot, cambios, motivo)
  values (p_id, v_ver, p_accion, v_snap,
          case when p_antes is null then null else public.factura_diferencias(p_antes, v_snap) end, p_motivo);
end $$;

-- Copia los datos actuales del cliente en la factura
create or replace function public.factura_copiar_cliente(p_id bigint)
returns void language sql
as $$
  update public.facturas f
     set cliente_numero = c.numero, cliente_nombre = c.nombre, cliente_documento = c.documento,
         cliente_telefono = c.telefono, cliente_direccion = c.direccion
    from public.clientes c where c.id = f.cliente_id and f.id = p_id
$$;

-- Reemplaza las líneas y recalcula los totales.
-- IVA = round(base_imponible × iva_pct / 100, 2) (se calcula sobre la base, no línea a línea)
create or replace function public.factura_guardar_lineas(p_id bigint, p_lineas jsonb)
returns void language plpgsql
as $$
declare l jsonb; i int := 0; v_prod public.productos; v_iva_pct numeric; v_cant numeric; v_precio numeric;
begin
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La factura debe tener al menos una línea.';
  end if;
  delete from public.factura_lineas where factura_id = p_id;
  for l in select * from jsonb_array_elements(p_lineas) loop
    i := i + 1;
    select * into v_prod from public.productos where id = (l->>'producto_id')::bigint;
    if v_prod.id is null then raise exception 'Producto inexistente en la línea %.', i; end if;
    v_cant := (l->>'cantidad')::numeric;
    v_precio := coalesce((l->>'precio_unitario')::numeric, 0);
    if v_cant is null or v_cant <= 0 then raise exception 'La cantidad de la línea % debe ser mayor a 0.', i; end if;
    if v_precio < 0 then raise exception 'El precio de la línea % no puede ser negativo.', i; end if;
    insert into public.factura_lineas (factura_id, orden, producto_id, codigo, descripcion, unidad,
                                       cantidad, precio_unitario, aplica_iva, total_linea)
    values (p_id, i, v_prod.id, v_prod.codigo, coalesce(nullif(trim(l->>'descripcion'), ''), v_prod.nombre),
            v_prod.unidad, v_cant, v_precio, coalesce((l->>'aplica_iva')::boolean, false),
            round(v_cant * v_precio, 2));
  end loop;

  select iva_pct into v_iva_pct from public.facturas where id = p_id;
  update public.facturas f set
    base_imponible = t.base, exento = t.exento, subtotal = t.base + t.exento,
    iva = round(t.base * v_iva_pct / 100, 2),
    total = t.base + t.exento + round(t.base * v_iva_pct / 100, 2)
  from (select coalesce(sum(total_linea) filter (where aplica_iva), 0) base,
               coalesce(sum(total_linea) filter (where not aplica_iva), 0) exento
          from public.factura_lineas where factura_id = p_id) t
  where f.id = p_id;
end $$;

-- Lleva el inventario de una factura a lo que dicen sus líneas actuales
-- (o a cero si está anulada). Devuelve advertencias de stock insuficiente.
create or replace function public.factura_sincronizar_inventario(p_id bigint)
returns jsonb language plpgsql
as $$
declare
  v_fact public.facturas; v_modo text; r record; v_adv jsonb := '[]'::jsonb;
  v_ubic bigint; v_disp numeric; v_falta numeric;
begin
  select * into v_fact from public.facturas where id = p_id;
  if v_fact.origen = 'externa' then return v_adv; end if;
  select stock_insuficiente into v_modo from public.empresa where id = 1;
  v_ubic := coalesce(v_fact.ubicacion_id, public.ubicacion_predeterminada());
  if v_ubic is null then
    raise exception 'No hay ubicaciones de inventario configuradas.';
  end if;

  for r in
    with objetivo as (
      select producto_id, v_ubic as ubicacion_id, sum(cantidad) cant
        from public.factura_lineas where factura_id = p_id and v_fact.estado = 'emitida'
       group by producto_id),
    actual as (
      select producto_id, ubicacion_id, -sum(cantidad) cant
        from public.movimientos_inventario where factura_id = p_id
       group by producto_id, ubicacion_id)
    select coalesce(o.producto_id, a.producto_id) producto_id,
           coalesce(o.ubicacion_id, a.ubicacion_id) ubicacion_id,
           coalesce(o.cant, 0) objetivo, coalesce(a.cant, 0) actual
      from objetivo o full join actual a on a.producto_id = o.producto_id and a.ubicacion_id = o.ubicacion_id
  loop
    if r.objetivo > r.actual then
      v_disp := public.stock_disponible(r.producto_id, r.ubicacion_id, public.forma_venta(r.producto_id));
      v_falta := (r.objetivo - r.actual) - v_disp;
      if v_falta > 0 then
        v_adv := v_adv || jsonb_build_object(
          'producto_id', r.producto_id,
          'producto', (select codigo || ' · ' || nombre from public.productos where id = r.producto_id),
          'disponible', v_disp, 'requerido', r.objetivo - r.actual);
        if v_modo = 'bloquear' then
          raise exception 'Stock insuficiente de % (disponible %, requerido %).',
            (select nombre from public.productos where id = r.producto_id), v_disp, r.objetivo - r.actual;
        end if;
      end if;
    end if;
    if r.objetivo <> r.actual then
      perform public.inv_ajustar_factura(p_id, r.producto_id, r.ubicacion_id, r.objetivo,
        'Factura ' || coalesce(v_fact.numero::text, '') ||
        case when v_fact.estado = 'anulada' then ' (anulación)' when v_fact.version > 1 then ' (edición)' else '' end);
    end if;
  end loop;
  return v_adv;
end $$;

-- Si lo pagado supera el total (por edición), libera aplicaciones empezando
-- por las más recientes; lo liberado queda como saldo a favor del cliente.
create or replace function public.factura_liberar_exceso(p_id bigint)
returns numeric language plpgsql
as $$
declare v_exceso numeric; r record; v_quita numeric; v_liberado numeric := 0;
begin
  select pagado - total into v_exceso from public.facturas where id = p_id;
  if v_exceso <= 0 then return 0; end if;
  for r in select id, monto from public.pago_aplicaciones where factura_id = p_id order by id desc loop
    exit when v_exceso <= 0;
    v_quita := least(v_exceso, r.monto);
    if v_quita = r.monto then
      delete from public.pago_aplicaciones where id = r.id;
    else
      update public.pago_aplicaciones set monto = monto - v_quita where id = r.id;
    end if;
    v_exceso := v_exceso - v_quita; v_liberado := v_liberado + v_quita;
  end loop;
  return v_liberado;
end $$;

-- Datos de cabecera desde el JSON de entrada
create or replace function public.factura_aplicar_cabecera(p_id bigint, p jsonb)
returns void language plpgsql
as $$
begin
  update public.facturas set
    cliente_id    = coalesce((p->>'cliente_id')::bigint, cliente_id),
    fecha         = coalesce((p->>'fecha')::date, fecha),
    moneda        = coalesce(p->>'moneda', moneda),
    condicion     = coalesce((p->>'condicion')::public.condicion_pago, condicion),
    ubicacion_id  = case when p ? 'ubicacion_id' then (p->>'ubicacion_id')::bigint else ubicacion_id end,
    observaciones = case when p ? 'observaciones' then nullif(trim(p->>'observaciones'), '') else observaciones end,
    iva_pct       = coalesce((p->>'iva_pct')::numeric, iva_pct)
  where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Guardar borrador (no afecta inventario ni saldos)
-- ---------------------------------------------------------------------
create or replace function public.guardar_borrador_factura(p jsonb)
returns bigint language plpgsql
as $$
declare v_id bigint := (p->>'id')::bigint; v_emp public.empresa;
begin
  perform public.exigir_rol('admin', 'facturacion');
  select * into v_emp from public.empresa where id = 1;
  if v_id is null then
    insert into public.facturas (estado, cliente_id, moneda, iva_pct, ubicacion_id)
    values ('borrador', (p->>'cliente_id')::bigint, coalesce(p->>'moneda', v_emp.moneda_defecto),
            coalesce((p->>'iva_pct')::numeric, v_emp.iva_pct),
            coalesce((p->>'ubicacion_id')::bigint, public.ubicacion_predeterminada()))
    returning id into v_id;
  elsif not exists (select 1 from public.facturas where id = v_id and estado = 'borrador') then
    raise exception 'Solo se pueden modificar como borrador las facturas en borrador.';
  end if;
  perform public.factura_aplicar_cabecera(v_id, p);
  perform public.factura_copiar_cliente(v_id);
  perform public.factura_guardar_lineas(v_id, p->'lineas');
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Emitir factura
-- p: {id? (borrador), cliente_id, fecha, moneda, condicion, ubicacion_id,
--     observaciones, iva_pct, lineas:[{producto_id, cantidad, precio_unitario, aplica_iva, descripcion?}],
--     empaques?: {retiradas, devueltas}, pago?: {monto, metodo_id, referencia, nota}}
-- Devuelve {id, numero, advertencias, pago_id}
-- ---------------------------------------------------------------------
create or replace function public.emitir_factura(p jsonb)
returns jsonb language plpgsql
as $$
declare
  v_id bigint := (p->>'id')::bigint; v_emp public.empresa; v_num bigint; v_adv jsonb;
  v_pago_id bigint; v_fact public.facturas; v_monto numeric;
begin
  perform public.exigir_rol('admin', 'facturacion');
  select * into v_emp from public.empresa where id = 1;
  if (p->>'cliente_id') is null and v_id is null then raise exception 'Seleccione el cliente.'; end if;

  if v_id is null then
    insert into public.facturas (estado, cliente_id, moneda, iva_pct, ubicacion_id)
    values ('borrador', (p->>'cliente_id')::bigint, coalesce(p->>'moneda', v_emp.moneda_defecto),
            coalesce((p->>'iva_pct')::numeric, v_emp.iva_pct),
            coalesce((p->>'ubicacion_id')::bigint, public.ubicacion_predeterminada()))
    returning id into v_id;
  else
    perform 1 from public.facturas where id = v_id and estado = 'borrador' for update;
    if not found then raise exception 'La factura ya fue emitida o no existe.'; end if;
  end if;

  perform public.factura_aplicar_cabecera(v_id, p);
  perform public.factura_copiar_cliente(v_id);
  if p ? 'lineas' or not exists (select 1 from public.factura_lineas where factura_id = v_id) then
    perform public.factura_guardar_lineas(v_id, p->'lineas');
  end if;

  v_num := public.siguiente_numero_factura();
  update public.facturas set estado = 'emitida', numero = v_num, emitida_el = now(), emitida_por = auth.uid()
   where id = v_id returning * into v_fact;
  if not exists (select 1 from public.clientes where id = v_fact.cliente_id and activo) then
    raise exception 'El cliente está inactivo.';
  end if;

  v_adv := public.factura_sincronizar_inventario(v_id);

  -- Empaques entregados (opcional)
  if coalesce((p->'empaques'->>'retiradas')::int, 0) + coalesce((p->'empaques'->>'devueltas')::int, 0) > 0 then
    insert into public.empaques_clientes (cliente_id, fecha, retiradas, devueltas, factura_id, nota)
    values (v_fact.cliente_id, v_fact.fecha, coalesce((p->'empaques'->>'retiradas')::int, 0),
            coalesce((p->'empaques'->>'devueltas')::int, 0), v_id, 'Factura ' || v_num);
  end if;

  -- Abono inicial (opcional)
  v_monto := coalesce((p->'pago'->>'monto')::numeric, 0);
  if v_monto > 0 then
    insert into public.pagos_clientes (cliente_id, fecha, moneda, monto, metodo_id, referencia, nota)
    values (v_fact.cliente_id, v_fact.fecha, v_fact.moneda, v_monto, (p->'pago'->>'metodo_id')::bigint,
            p->'pago'->>'referencia', coalesce(p->'pago'->>'nota', 'Abono inicial factura ' || v_num))
    returning id into v_pago_id;
    insert into public.pago_aplicaciones (pago_id, factura_id, monto)
    values (v_pago_id, v_id, least(v_monto, v_fact.total));
  end if;

  perform public.registrar_version_factura(v_id, 'EMITIR', null, null);
  perform public.auditar('EMITIR', 'facturas', v_id::text, null,
                         jsonb_build_object('numero', v_num, 'total', v_fact.total, 'moneda', v_fact.moneda));
  return jsonb_build_object('id', v_id, 'numero', v_num, 'advertencias', v_adv, 'pago_id', v_pago_id);
end $$;

-- ---------------------------------------------------------------------
-- Editar factura emitida (mismo número)
-- p: igual que emitir + {id, motivo?, tasa_conversion?}
-- Devuelve {id, advertencias, saldo_a_favor_generado, pagos_convertidos}
-- ---------------------------------------------------------------------
create or replace function public.editar_factura(p jsonb)
returns jsonb language plpgsql
as $$
declare
  v_id bigint := (p->>'id')::bigint; v_antes jsonb; v_old public.facturas; v_new public.facturas;
  v_emp public.empresa; v_adv jsonb; v_liberado numeric := 0; v_tasa numeric; r record;
  v_pago_neg bigint; v_pago_pos bigint; v_convertidos int := 0; v_pos_ids bigint[] := '{}';
  v_nueva_moneda text;
begin
  if not public.puede_editar_facturas() then
    raise exception 'Tu rol no tiene permiso para editar facturas.' using errcode = '42501';
  end if;
  select * into v_emp from public.empresa where id = 1;
  select * into v_old from public.facturas where id = v_id for update;
  if v_old.id is null then raise exception 'Factura no encontrada.'; end if;
  if v_old.estado = 'anulada' then raise exception 'Una factura anulada no se puede editar.'; end if;
  if v_old.estado = 'borrador' then
    perform public.guardar_borrador_factura(p);
    return jsonb_build_object('id', v_id, 'advertencias', '[]'::jsonb);
  end if;

  v_antes := public.factura_snapshot(v_id);
  v_nueva_moneda := coalesce(p->>'moneda', v_old.moneda);

  -- Cambio de cliente con pagos aplicados: los pagos son del cliente anterior
  if (p->>'cliente_id') is not null and (p->>'cliente_id')::bigint <> v_old.cliente_id and v_old.pagado > 0 then
    raise exception 'La factura tiene pagos aplicados del cliente actual. Elimine o reasigne los pagos antes de cambiar el cliente.';
  end if;

  -- Cambio de moneda con pagos aplicados
  if v_nueva_moneda <> v_old.moneda and v_old.pagado > 0 then
    if v_emp.cambio_moneda_con_pagos = 'bloquear' then
      raise exception 'La factura tiene pagos en %; el cambio de moneda está bloqueado en Configuración.', v_old.moneda;
    end if;
    v_tasa := (p->>'tasa_conversion')::numeric;
    if v_tasa is null or v_tasa <= 0 then
      raise exception 'Indique la tasa de cambio (1 % = ? %) para convertir los pagos ya aplicados.', v_old.moneda, v_nueva_moneda;
    end if;
    -- Se desaplican los pagos y se convierten: −X en la moneda vieja, +X×tasa en la nueva
    for r in select a.id, a.pago_id, a.monto, pc.fecha, pc.metodo_id, pc.referencia
               from public.pago_aplicaciones a join public.pagos_clientes pc on pc.id = a.pago_id
              where a.factura_id = v_id loop
      delete from public.pago_aplicaciones where id = r.id;
      insert into public.pagos_clientes (cliente_id, fecha, moneda, monto, tipo, metodo_id, referencia, nota, pago_origen_id, tasa_conversion)
      values (v_old.cliente_id, r.fecha, v_old.moneda, -r.monto, 'conversion', r.metodo_id, r.referencia,
              'Conversión a ' || v_nueva_moneda || ' por cambio de moneda de la factura ' || v_old.numero, r.pago_id, v_tasa)
      returning id into v_pago_neg;
      insert into public.pagos_clientes (cliente_id, fecha, moneda, monto, tipo, metodo_id, referencia, nota, pago_origen_id, tasa_conversion)
      values (v_old.cliente_id, r.fecha, v_nueva_moneda, round(r.monto * v_tasa, 2), 'conversion', r.metodo_id, r.referencia,
              'Conversión desde ' || v_old.moneda || ' (tasa ' || v_tasa || ') factura ' || v_old.numero, r.pago_id, v_tasa)
      returning id into v_pago_pos;
      v_pos_ids := v_pos_ids || v_pago_pos;
      v_convertidos := v_convertidos + 1;
    end loop;
  end if;

  perform public.factura_aplicar_cabecera(v_id, p);
  perform public.factura_copiar_cliente(v_id);
  if p ? 'lineas' then
    perform public.factura_guardar_lineas(v_id, p->'lineas');
  end if;

  -- Reaplicar los pagos convertidos a esta factura
  if v_convertidos > 0 then
    insert into public.pago_aplicaciones (pago_id, factura_id, monto)
    select pc.id, v_id, pc.monto from public.pagos_clientes pc where pc.id = any(v_pos_ids);
  end if;

  v_liberado := public.factura_liberar_exceso(v_id);
  v_adv := public.factura_sincronizar_inventario(v_id);
  perform public.registrar_version_factura(v_id, 'EDITAR', v_antes, p->>'motivo');
  select * into v_new from public.facturas where id = v_id;
  perform public.auditar('EDITAR', 'facturas', v_id::text, v_antes - 'lineas', public.factura_snapshot(v_id) - 'lineas', p->>'motivo');

  return jsonb_build_object('id', v_id, 'numero', v_new.numero, 'advertencias', v_adv,
                            'saldo_a_favor_generado', v_liberado, 'pagos_convertidos', v_convertidos);
end $$;

-- ---------------------------------------------------------------------
-- Anular factura (nunca se borra). Revierte inventario y cuenta por cobrar:
-- los pagos que tenía aplicados quedan como saldo a favor del cliente.
-- ---------------------------------------------------------------------
create or replace function public.anular_factura(p_id bigint, p_motivo text)
returns jsonb language plpgsql
as $$
declare v_antes jsonb; v_fact public.facturas; v_liberado numeric;
begin
  perform public.exigir_rol('admin', 'facturacion');
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indique el motivo de la anulación.'; end if;
  select * into v_fact from public.facturas where id = p_id for update;
  if v_fact.id is null then raise exception 'Factura no encontrada.'; end if;
  if v_fact.estado = 'anulada' then raise exception 'La factura ya está anulada.'; end if;
  if v_fact.estado = 'borrador' then
    delete from public.facturas where id = p_id;   -- un borrador sí se puede descartar
    return jsonb_build_object('id', p_id, 'borrador_eliminado', true);
  end if;
  v_antes := public.factura_snapshot(p_id);
  v_liberado := v_fact.pagado;
  delete from public.pago_aplicaciones where factura_id = p_id;
  update public.facturas set estado = 'anulada', anulada_el = now(), anulada_por = auth.uid(),
                             motivo_anulacion = trim(p_motivo)
   where id = p_id;
  perform public.factura_sincronizar_inventario(p_id);
  perform public.registrar_version_factura(p_id, 'ANULAR', v_antes, p_motivo);
  perform public.auditar('ANULAR', 'facturas', p_id::text, v_antes - 'lineas', null, p_motivo);
  return jsonb_build_object('id', p_id, 'saldo_a_favor_generado', v_liberado);
end $$;

-- ---------------------------------------------------------------------
-- Factura externa / histórica (migración o carga manual). No toca inventario.
-- ---------------------------------------------------------------------
create or replace function public.registrar_factura_externa(p jsonb)
returns bigint language plpgsql
as $$
declare v_id bigint; v_total numeric := (p->>'total')::numeric;
begin
  perform public.exigir_rol('admin', 'facturacion');
  if v_total is null or v_total < 0 then raise exception 'Indique el monto de la factura.'; end if;
  insert into public.facturas (origen, estado, numero_externo, cliente_id, fecha, moneda, condicion,
                               observaciones, iva_pct, exento, subtotal, total, soporte_url, soporte_path,
                               emitida_el, emitida_por, version)
  values ('externa', 'emitida', nullif(trim(p->>'numero_externo'), ''), (p->>'cliente_id')::bigint,
          coalesce((p->>'fecha')::date, public.hoy()), p->>'moneda', 'credito', p->>'observaciones', 0,
          v_total, v_total, v_total, p->>'soporte_url', p->>'soporte_path', now(), auth.uid(), 1)
  returning id into v_id;
  perform public.factura_copiar_cliente(v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Pagos de clientes
-- p: {cliente_id, fecha, moneda, monto, metodo_id, referencia, nota,
--     aplicaciones: [{factura_id, monto}]}
-- Lo no aplicado queda como saldo a favor del cliente en esa moneda.
-- ---------------------------------------------------------------------
create or replace function public.registrar_pago_cliente(p jsonb)
returns jsonb language plpgsql
as $$
declare v_id bigint; v_num bigint; v_monto numeric := (p->>'monto')::numeric; a jsonb; v_aplicado numeric := 0;
begin
  perform public.exigir_rol('admin', 'facturacion');
  if v_monto is null or v_monto <= 0 then raise exception 'El monto del pago debe ser mayor a 0.'; end if;
  insert into public.pagos_clientes (cliente_id, fecha, moneda, monto, metodo_id, referencia, nota)
  values ((p->>'cliente_id')::bigint, coalesce((p->>'fecha')::date, public.hoy()), p->>'moneda', v_monto,
          (p->>'metodo_id')::bigint, nullif(trim(p->>'referencia'), ''), nullif(trim(p->>'nota'), ''))
  returning id, numero into v_id, v_num;
  for a in select * from jsonb_array_elements(coalesce(p->'aplicaciones', '[]'::jsonb)) loop
    if coalesce((a->>'monto')::numeric, 0) > 0 then
      insert into public.pago_aplicaciones (pago_id, factura_id, monto)
      values (v_id, (a->>'factura_id')::bigint, (a->>'monto')::numeric);
      v_aplicado := v_aplicado + (a->>'monto')::numeric;
    end if;
  end loop;
  if v_aplicado > v_monto then
    raise exception 'Lo aplicado a facturas (%) supera el monto recibido (%).', v_aplicado, v_monto;
  end if;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'aplicado', v_aplicado, 'saldo_a_favor', v_monto - v_aplicado);
end $$;

-- Editar un pago: datos y reparto (las aplicaciones se reemplazan por las indicadas)
create or replace function public.editar_pago_cliente(p_id bigint, p jsonb)
returns jsonb language plpgsql
as $$
declare v_pago public.pagos_clientes; a jsonb; v_aplicado numeric := 0; v_monto numeric;
begin
  perform public.exigir_rol('admin', 'facturacion');
  select * into v_pago from public.pagos_clientes where id = p_id for update;
  if v_pago.id is null then raise exception 'Pago no encontrado.'; end if;
  if v_pago.tipo <> 'pago' then raise exception 'Las conversiones automáticas no se editan.'; end if;
  v_monto := coalesce((p->>'monto')::numeric, v_pago.monto);
  if v_monto <= 0 then raise exception 'El monto del pago debe ser mayor a 0.'; end if;
  if (p->>'moneda') is not null and p->>'moneda' <> v_pago.moneda then
    raise exception 'No se puede cambiar la moneda de un pago; elimínelo y regístrelo de nuevo.';
  end if;
  update public.pagos_clientes set
    fecha = coalesce((p->>'fecha')::date, fecha), monto = v_monto,
    metodo_id = case when p ? 'metodo_id' then (p->>'metodo_id')::bigint else metodo_id end,
    referencia = case when p ? 'referencia' then nullif(trim(p->>'referencia'), '') else referencia end,
    nota = case when p ? 'nota' then nullif(trim(p->>'nota'), '') else nota end
  where id = p_id;
  if p ? 'aplicaciones' then
    delete from public.pago_aplicaciones where pago_id = p_id;
    for a in select * from jsonb_array_elements(p->'aplicaciones') loop
      if coalesce((a->>'monto')::numeric, 0) > 0 then
        insert into public.pago_aplicaciones (pago_id, factura_id, monto)
        values (p_id, (a->>'factura_id')::bigint, (a->>'monto')::numeric);
        v_aplicado := v_aplicado + (a->>'monto')::numeric;
      end if;
    end loop;
  else
    select coalesce(sum(monto), 0) into v_aplicado from public.pago_aplicaciones where pago_id = p_id;
  end if;
  if v_aplicado > v_monto then
    raise exception 'Lo aplicado a facturas (%) supera el monto del pago (%).', v_aplicado, v_monto;
  end if;
  return jsonb_build_object('id', p_id, 'aplicado', v_aplicado, 'saldo_a_favor', v_monto - v_aplicado);
end $$;

create or replace function public.eliminar_pago_cliente(p_id bigint)
returns void language plpgsql
as $$
declare v_tipo public.tipo_pago_cliente;
begin
  perform public.exigir_rol('admin', 'facturacion');
  select tipo into v_tipo from public.pagos_clientes where id = p_id;
  if v_tipo is null then raise exception 'Pago no encontrado.'; end if;
  if v_tipo <> 'pago' then raise exception 'Las conversiones automáticas no se eliminan por separado.'; end if;
  -- Las conversiones derivadas se eliminan en cascada (pago_origen_id)
  delete from public.pagos_clientes where id = p_id;
end $$;

-- Saldo a favor disponible de un cliente en una moneda
create or replace function public.saldo_a_favor(p_cliente_id bigint, p_moneda text)
returns numeric language sql stable
as $$
  select coalesce(sum(pc.monto), 0)
       - coalesce((select sum(a.monto) from public.pago_aplicaciones a
                    join public.pagos_clientes x on x.id = a.pago_id
                   where x.cliente_id = p_cliente_id and x.moneda = p_moneda), 0)
    from public.pagos_clientes pc
   where pc.cliente_id = p_cliente_id and pc.moneda = p_moneda
$$;

-- Aplica saldo a favor a una factura (toma de los pagos con remanente, del más viejo al más nuevo)
create or replace function public.aplicar_saldo_a_favor(p_factura_id bigint, p_monto numeric)
returns numeric language plpgsql
as $$
declare v_fact public.facturas; v_disp numeric; v_rest numeric; r record; v_toma numeric;
begin
  perform public.exigir_rol('admin', 'facturacion');
  select * into v_fact from public.facturas where id = p_factura_id for update;
  if v_fact.estado <> 'emitida' then raise exception 'La factura no está emitida.'; end if;
  v_disp := public.saldo_a_favor(v_fact.cliente_id, v_fact.moneda);
  v_rest := least(coalesce(p_monto, v_fact.saldo), v_fact.saldo, v_disp);
  if v_rest <= 0 then raise exception 'No hay saldo a favor disponible en %.', v_fact.moneda; end if;
  for r in
    select pc.id, pc.monto - coalesce(sum(a.monto), 0) as remanente
      from public.pagos_clientes pc left join public.pago_aplicaciones a on a.pago_id = pc.id
     where pc.cliente_id = v_fact.cliente_id and pc.moneda = v_fact.moneda and pc.monto > 0
     group by pc.id having pc.monto - coalesce(sum(a.monto), 0) > 0
     order by pc.fecha, pc.id
  loop
    exit when v_rest <= 0;
    v_toma := least(v_rest, r.remanente);
    insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (r.id, p_factura_id, v_toma)
    on conflict (pago_id, factura_id) do update set monto = public.pago_aplicaciones.monto + excluded.monto;
    v_rest := v_rest - v_toma;
  end loop;
  return least(coalesce(p_monto, v_fact.saldo), v_fact.saldo, v_disp) - v_rest;
end $$;

-- Último precio usado para un cliente/producto/moneda (solo sugerencia)
create or replace function public.ultimo_precio(p_cliente_id bigint, p_producto_id bigint, p_moneda text)
returns numeric language sql stable
as $$
  select l.precio_unitario from public.factura_lineas l join public.facturas f on f.id = l.factura_id
   where f.cliente_id = p_cliente_id and l.producto_id = p_producto_id and f.moneda = p_moneda
     and f.estado = 'emitida'
   order by f.fecha desc, f.id desc limit 1
$$;
