-- =====================================================================
-- Tierra Santa · El inventario se descuenta al facturar solo desde que se activa
--
-- Mientras no se haga el inventario general, las facturas no descuentan
-- stock (no "quedan debiendo" al inventario). Al registrar el conteo se
-- activa el control (Inventario → "Empezar a descontar al facturar") y desde
-- ese momento cada factura emitida descuenta. Las emitidas antes nunca
-- descuentan, ni siquiera si se editan o anulan después.
-- =====================================================================
alter table public.empresa add column if not exists inventario_desde timestamptz;
comment on column public.empresa.inventario_desde is
  'Desde cuándo las facturas descuentan inventario (null = todavía no descuentan).';

create or replace function public.factura_sincronizar_inventario(p_id bigint)
returns jsonb language plpgsql
as $$
declare
  v_fact public.facturas; v_modo text; r record; v_adv jsonb := '[]'::jsonb;
  v_ubic bigint; v_disp numeric; v_falta numeric; v_desde timestamptz;
begin
  select * into v_fact from public.facturas where id = p_id;
  select stock_insuficiente, inventario_desde into v_modo, v_desde from public.empresa where id = 1;
  -- Históricas, y facturas emitidas antes de empezar a controlar el inventario: no lo tocan
  if v_fact.origen = 'externa' or v_desde is null or coalesce(v_fact.emitida_el, now()) < v_desde then
    return v_adv;
  end if;
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

-- Activar / desactivar el control (solo administración)
create or replace function public.activar_control_inventario(p_activar boolean)
returns timestamptz language plpgsql security definer
set search_path = public
as $$
declare v timestamptz;
begin
  perform public.exigir_rol('admin');
  update public.empresa set inventario_desde = case when p_activar then now() end where id = 1
  returning inventario_desde into v;
  return v;
end $$;
revoke execute on function public.activar_control_inventario(boolean) from public, anon;
grant execute on function public.activar_control_inventario(boolean) to authenticated;
