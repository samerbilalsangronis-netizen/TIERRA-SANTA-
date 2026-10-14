-- =====================================================================
-- Tierra Santa · Los pagos de clientes se aplican solos a las facturas
--
-- Regla: todo dinero recibido que no se haya aplicado a una factura se
-- aplica automáticamente a las facturas pendientes del cliente en esa
-- misma moneda, de la más vieja a la más nueva. Solo queda "a favor" del
-- cliente lo que sobre cuando ya no debe nada en esa moneda.
-- Se ejecuta después de: registrar/editar/eliminar un pago, emitir/editar/
-- anular una factura y registrar/editar una factura histórica.
-- =====================================================================

-- Aplica el dinero disponible de un cliente (en todas sus monedas)
create or replace function public.aplicar_credito_cliente(p_cliente_id bigint)
returns numeric language plpgsql security definer
set search_path = public
as $$
declare
  v_moneda text; v_disp numeric; f record; r record; v_falta numeric; v_toma numeric; v_total numeric := 0;
begin
  if p_cliente_id is null then return 0; end if;
  for v_moneda in select distinct moneda from public.pagos_clientes where cliente_id = p_cliente_id loop
    v_disp := public.saldo_a_favor(p_cliente_id, v_moneda);
    continue when v_disp <= 0;
    for f in
      select id, saldo from public.facturas
       where cliente_id = p_cliente_id and moneda = v_moneda and estado = 'emitida' and saldo > 0
       order by fecha, id
    loop
      exit when v_disp <= 0;
      v_falta := least(f.saldo, v_disp);
      for r in
        select pc.id, pc.monto - coalesce((select sum(a.monto) from public.pago_aplicaciones a where a.pago_id = pc.id), 0) as remanente
          from public.pagos_clientes pc
         where pc.cliente_id = p_cliente_id and pc.moneda = v_moneda and pc.monto > 0
         order by pc.fecha, pc.id
      loop
        exit when v_falta <= 0;
        continue when r.remanente <= 0;
        v_toma := least(v_falta, r.remanente);
        insert into public.pago_aplicaciones (pago_id, factura_id, monto) values (r.id, f.id, v_toma)
        on conflict (pago_id, factura_id) do update set monto = public.pago_aplicaciones.monto + excluded.monto;
        v_falta := v_falta - v_toma; v_disp := v_disp - v_toma; v_total := v_total + v_toma;
      end loop;
    end loop;
  end loop;
  return v_total;
end $$;
revoke execute on function public.aplicar_credito_cliente(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Envolver las funciones existentes: hacen lo mismo y al final aplican el
-- dinero disponible. Las originales quedan como "_base" (no ejecutables
-- directamente por los usuarios).
-- ---------------------------------------------------------------------
alter function public.registrar_pago_cliente(jsonb) rename to _registrar_pago_cliente_base;
alter function public.editar_pago_cliente(bigint, jsonb) rename to _editar_pago_cliente_base;
alter function public.eliminar_pago_cliente(bigint) rename to _eliminar_pago_cliente_base;
alter function public.emitir_factura(jsonb) rename to _emitir_factura_base;
alter function public.editar_factura(jsonb) rename to _editar_factura_base;
alter function public.anular_factura(bigint, text) rename to _anular_factura_base;
alter function public.registrar_factura_externa(jsonb) rename to _registrar_factura_externa_base;
alter function public.editar_factura_externa(jsonb) rename to _editar_factura_externa_base;

revoke execute on function public._registrar_pago_cliente_base(jsonb) from public, anon, authenticated;
revoke execute on function public._editar_pago_cliente_base(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public._eliminar_pago_cliente_base(bigint) from public, anon, authenticated;
revoke execute on function public._emitir_factura_base(jsonb) from public, anon, authenticated;
revoke execute on function public._editar_factura_base(jsonb) from public, anon, authenticated;
revoke execute on function public._anular_factura_base(bigint, text) from public, anon, authenticated;
revoke execute on function public._registrar_factura_externa_base(jsonb) from public, anon, authenticated;
revoke execute on function public._editar_factura_externa_base(jsonb) from public, anon, authenticated;

create or replace function public.registrar_pago_cliente(p jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v jsonb; v_auto numeric;
begin
  v := public._registrar_pago_cliente_base(p);
  v_auto := public.aplicar_credito_cliente((p->>'cliente_id')::bigint);
  return v || jsonb_build_object(
    'aplicado', (v->>'aplicado')::numeric + v_auto,
    'aplicado_automatico', v_auto,
    'saldo_a_favor', public.saldo_a_favor((p->>'cliente_id')::bigint, p->>'moneda'));
end $$;

create or replace function public.editar_pago_cliente(p_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v jsonb; v_cliente bigint; v_moneda text;
begin
  v := public._editar_pago_cliente_base(p_id, p);
  select cliente_id, moneda into v_cliente, v_moneda from public.pagos_clientes where id = p_id;
  perform public.aplicar_credito_cliente(v_cliente);
  return v || jsonb_build_object('saldo_a_favor', public.saldo_a_favor(v_cliente, v_moneda));
end $$;

create or replace function public.eliminar_pago_cliente(p_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare v_cliente bigint;
begin
  select cliente_id into v_cliente from public.pagos_clientes where id = p_id;
  perform public._eliminar_pago_cliente_base(p_id);
  perform public.aplicar_credito_cliente(v_cliente);
end $$;

create or replace function public.emitir_factura(p jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v jsonb;
begin
  v := public._emitir_factura_base(p);
  perform public.aplicar_credito_cliente((select cliente_id from public.facturas where id = (v->>'id')::bigint));
  return v;
end $$;

create or replace function public.editar_factura(p jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v jsonb; v_antes bigint;
begin
  select cliente_id into v_antes from public.facturas where id = (p->>'id')::bigint;
  v := public._editar_factura_base(p);
  perform public.aplicar_credito_cliente(v_antes);
  perform public.aplicar_credito_cliente((select cliente_id from public.facturas where id = (p->>'id')::bigint));
  return v;
end $$;

create or replace function public.anular_factura(p_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v jsonb; v_cliente bigint;
begin
  select cliente_id into v_cliente from public.facturas where id = p_id;
  v := public._anular_factura_base(p_id, p_motivo);
  perform public.aplicar_credito_cliente(v_cliente);
  return v;
end $$;

create or replace function public.registrar_factura_externa(p jsonb)
returns bigint language plpgsql security definer set search_path = public
as $$
declare v bigint;
begin
  v := public._registrar_factura_externa_base(p);
  perform public.aplicar_credito_cliente((p->>'cliente_id')::bigint);
  return v;
end $$;

create or replace function public.editar_factura_externa(p jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public._editar_factura_externa_base(p);
  perform public.aplicar_credito_cliente((select cliente_id from public.facturas where id = (p->>'id')::bigint));
end $$;

grant execute on function public.registrar_pago_cliente(jsonb) to authenticated;
grant execute on function public.editar_pago_cliente(bigint, jsonb) to authenticated;
grant execute on function public.eliminar_pago_cliente(bigint) to authenticated;
grant execute on function public.emitir_factura(jsonb) to authenticated;
grant execute on function public.editar_factura(jsonb) to authenticated;
grant execute on function public.anular_factura(bigint, text) to authenticated;
grant execute on function public.registrar_factura_externa(jsonb) to authenticated;
grant execute on function public.editar_factura_externa(jsonb) to authenticated;
revoke execute on function public.registrar_pago_cliente(jsonb) from anon;
revoke execute on function public.editar_pago_cliente(bigint, jsonb) from anon;
revoke execute on function public.eliminar_pago_cliente(bigint) from anon;
revoke execute on function public.emitir_factura(jsonb) from anon;
revoke execute on function public.editar_factura(jsonb) from anon;
revoke execute on function public.anular_factura(bigint, text) from anon;
revoke execute on function public.registrar_factura_externa(jsonb) from anon;
revoke execute on function public.editar_factura_externa(jsonb) from anon;

-- Corrige los pagos que ya quedaron sin aplicar
select public.aplicar_credito_cliente(id) from public.clientes;
