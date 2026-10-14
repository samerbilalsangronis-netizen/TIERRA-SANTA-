-- =====================================================================
-- Tierra Santa · Fase 7 · Nómina
-- Protección de periodos cerrados también al borrar, resumen previo de un
-- periodo (lo mismo que congela el cierre) y eliminar jornada.
-- =====================================================================

-- 1) No se borran jornadas ni se tocan sus tareas si la fecha está en un periodo cerrado
create or replace function public.tg_jornada_borrar_periodo()
returns trigger language plpgsql as $$
begin
  if public.fecha_en_periodo_cerrado(old.fecha) then
    raise exception 'La fecha % pertenece a un periodo de nómina cerrado.', to_char(old.fecha, 'DD/MM/YYYY');
  end if;
  return old;
end $$;
drop trigger if exists jornadas_borrar_periodo on public.jornadas;
create trigger jornadas_borrar_periodo before delete on public.jornadas
  for each row execute function public.tg_jornada_borrar_periodo();

create or replace function public.tg_jornada_tareas_periodo()
returns trigger language plpgsql as $$
declare v_fecha date;
begin
  select fecha into v_fecha from public.jornadas where id = coalesce(new.jornada_id, old.jornada_id);
  if v_fecha is not null and public.fecha_en_periodo_cerrado(v_fecha) then
    raise exception 'La fecha % pertenece a un periodo de nómina cerrado.', to_char(v_fecha, 'DD/MM/YYYY');
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists jornada_tareas_periodo on public.jornada_tareas;
create trigger jornada_tareas_periodo before insert or update or delete on public.jornada_tareas
  for each row execute function public.tg_jornada_tareas_periodo();

-- 2) Resumen de un rango (para ver un periodo abierto antes de cerrarlo).
--    Mismo cálculo que cerrar_periodo_nomina: saldo anterior + ganado − abonos.
create or replace function public.nomina_resumen(p_desde date, p_hasta date)
returns table (empleado_id bigint, nombre text, tipo public.tipo_empleado, activo boolean,
               dias_asistidos bigint, medias bigint, faltas bigint, total_dias numeric, total_tareas numeric,
               ganado numeric, abonos numeric, saldo_anterior numeric, neto numeric)
language sql stable security invoker
set search_path = public
as $$
  select e.id, e.nombre, e.tipo, e.activo,
         coalesce(j.asistidos, 0), coalesce(j.medias, 0), coalesce(j.faltas, 0),
         coalesce(j.total_dias, 0), coalesce(j.total_tareas, 0), coalesce(j.ganado, 0),
         coalesce(a.abonos, 0), coalesce(s.saldo, 0),
         coalesce(s.saldo, 0) + coalesce(j.ganado, 0) - coalesce(a.abonos, 0)
    from public.empleados e
    left join (select jo.empleado_id,
                      count(*) filter (where jo.estado in ('asistio', 'produccion')) asistidos,
                      count(*) filter (where jo.estado = 'media') medias,
                      count(*) filter (where jo.estado = 'no') faltas,
                      sum(jo.pago_dia + jo.pago_adicional) total_dias, sum(jo.total_tareas) total_tareas, sum(jo.ganado) ganado
                 from public.jornadas jo where jo.fecha between p_desde and p_hasta group by jo.empleado_id) j on j.empleado_id = e.id
    left join (select ab.empleado_id, sum(ab.monto) abonos from public.abonos_empleados ab
                where ab.fecha between p_desde and p_hasta group by ab.empleado_id) a on a.empleado_id = e.id
    left join (select x.empleado_id, sum(x.m) saldo from (
                 select jo.empleado_id, jo.ganado m from public.jornadas jo where jo.fecha < p_desde
                 union all
                 select ab.empleado_id, -ab.monto from public.abonos_empleados ab where ab.fecha < p_desde) x
               group by x.empleado_id) s on s.empleado_id = e.id
   where e.activo or j.empleado_id is not null or a.empleado_id is not null or coalesce(s.saldo, 0) <> 0
   order by public.normalizar(e.nombre)
$$;

revoke execute on function public.nomina_resumen(date, date) from public, anon;
grant execute on function public.nomina_resumen(date, date) to authenticated;
