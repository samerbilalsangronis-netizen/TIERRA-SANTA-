-- =====================================================================
-- Tierra Santa · 0006 · Nómina: empleados (fijo / destajo), tareas,
-- jornadas con tareas, abonos/adelantos, periodos con cierre.
-- Moneda de la nómina: COP.
-- =====================================================================

create type public.tipo_empleado as enum ('fijo', 'destajo');
-- asistio: jornada completa · media: media jornada · produccion: solo tareas · no: falta
create type public.estado_jornada as enum ('asistio', 'media', 'produccion', 'no');

create table public.empleados (
  id             bigint generated always as identity primary key,
  codigo         text,                 -- id del sistema anterior / ficha
  nombre         text not null check (length(trim(nombre)) > 0),
  cedula         text,
  telefono       text,
  cargo          text,                 -- cargo / área
  tipo           public.tipo_empleado not null default 'destajo',
  tarifa_dia     numeric(14,2) not null default 0 check (tarifa_dia >= 0),  -- cuánto gana por día (fijos)
  fecha_ingreso  date,
  fecha_registro date not null default public.hoy(),
  activo         boolean not null default true,
  notas          text,
  search         text generated always as (public.normalizar(nombre || ' ' || coalesce(cedula, ''))) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index empleados_codigo_uk on public.empleados (codigo) where codigo is not null;
create index empleados_search_trgm on public.empleados using gin (search extensions.gin_trgm_ops);
create trigger empleados_updated_at before update on public.empleados
  for each row execute function public.tg_set_updated_at();
create trigger empleados_auditar after insert or update or delete on public.empleados
  for each row execute function public.tg_auditar();

-- Catálogo de tareas a destajo ("Despulpar Fresa — $2.000/cesta")
create table public.tareas_nomina (
  id      bigint generated always as identity primary key,
  codigo  text,                       -- id del sistema anterior
  emoji   text,
  nombre  text not null,
  valor   numeric(14,2) not null check (valor >= 0),  -- COP por unidad
  unidad  text not null default 'cesta',
  activa  boolean not null default true,
  orden   smallint not null default 0
);
create unique index tareas_nomina_nombre_uk on public.tareas_nomina (public.normalizar(nombre));
create trigger tareas_nomina_auditar after insert or update or delete on public.tareas_nomina
  for each row execute function public.tg_auditar();

-- ---------------------------------------------------------------------
-- Periodos de nómina
-- ---------------------------------------------------------------------
create table public.periodos_nomina (
  id          bigint generated always as identity primary key,
  desde       date not null,
  hasta       date not null,
  estado      text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_el  timestamptz,
  cerrado_por uuid references public.profiles(id),
  nota        text,
  created_at  timestamptz not null default now(),
  constraint periodos_rango check (hasta >= desde)
);
create index periodos_nomina_rango_idx on public.periodos_nomina (desde, hasta);

create or replace function public.tg_periodo_sin_solape()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.periodos_nomina p
              where p.id <> new.id and daterange(p.desde, p.hasta, '[]') && daterange(new.desde, new.hasta, '[]')) then
    raise exception 'El periodo se solapa con otro periodo existente.';
  end if;
  return new;
end $$;
create trigger periodos_sin_solape before insert or update on public.periodos_nomina
  for each row execute function public.tg_periodo_sin_solape();

-- ¿La fecha cae en un periodo cerrado?
create or replace function public.fecha_en_periodo_cerrado(p_fecha date)
returns boolean language sql stable
as $$ select exists (select 1 from public.periodos_nomina
                      where estado = 'cerrado' and p_fecha between desde and hasta) $$;

-- ---------------------------------------------------------------------
-- Jornadas (una por empleado y fecha)
-- ---------------------------------------------------------------------
create table public.jornadas (
  id              bigint generated always as identity primary key,
  empleado_id     bigint not null references public.empleados(id),
  fecha           date not null,
  estado          public.estado_jornada not null,
  justificada     boolean not null default false,
  tarifa_aplicada numeric(14,2) not null default 0,   -- tarifa del fijo al registrar
  pago_dia        numeric(14,2) not null default 0,   -- calculado: tarifa / mitad / 0
  pago_adicional  numeric(14,2) not null default 0 check (pago_adicional >= 0), -- "pago adicional por día"
  total_tareas    numeric(14,2) not null default 0,   -- Σ cantidad × valor (trigger)
  ganado          numeric(14,2) generated always as (pago_dia + pago_adicional + total_tareas) stored,
  nota            text,
  created_by      uuid references public.profiles(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint jornadas_uk unique (empleado_id, fecha)
);
create index jornadas_fecha_idx on public.jornadas (fecha);
create trigger jornadas_updated_at before update on public.jornadas
  for each row execute function public.tg_set_updated_at();
create trigger jornadas_auditar after insert or update or delete on public.jornadas
  for each row execute function public.tg_auditar();

create table public.jornada_tareas (
  id             bigint generated always as identity primary key,
  jornada_id     bigint not null references public.jornadas(id) on delete cascade,
  tarea_id       bigint not null references public.tareas_nomina(id),
  cantidad       numeric(12,2) not null check (cantidad > 0),
  valor_unitario numeric(14,2) not null check (valor_unitario >= 0),  -- copia del valor de la tarea
  subtotal       numeric(14,2) generated always as (round(cantidad * valor_unitario, 2)) stored,
  constraint jornada_tareas_uk unique (jornada_id, tarea_id)
);
create index jornada_tareas_tarea_idx on public.jornada_tareas (tarea_id);

-- Pago del día según tipo de empleado y estado
create or replace function public.tg_jornada_calcular()
returns trigger language plpgsql as $$
declare v_emp public.empleados;
begin
  if public.fecha_en_periodo_cerrado(new.fecha)
     or (tg_op = 'UPDATE' and public.fecha_en_periodo_cerrado(old.fecha)) then
    raise exception 'La fecha % pertenece a un periodo de nómina cerrado.', to_char(new.fecha, 'DD/MM/YYYY');
  end if;
  select * into v_emp from public.empleados where id = new.empleado_id;
  if tg_op = 'INSERT' and coalesce(new.tarifa_aplicada, 0) = 0 then
    new.tarifa_aplicada := v_emp.tarifa_dia;
  end if;
  if v_emp.tipo = 'fijo' then
    new.pago_dia := case new.estado
      when 'asistio' then new.tarifa_aplicada
      when 'media'   then round(new.tarifa_aplicada / 2, 2)
      else 0 end;
  else
    new.pago_dia := 0;
  end if;
  return new;
end $$;
create trigger jornadas_calcular before insert or update on public.jornadas
  for each row execute function public.tg_jornada_calcular();

create or replace function public.tg_jornada_tareas_total()
returns trigger language plpgsql as $$
declare v_id bigint := coalesce(new.jornada_id, old.jornada_id);
begin
  update public.jornadas j
     set total_tareas = coalesce((select sum(subtotal) from public.jornada_tareas where jornada_id = v_id), 0)
   where j.id = v_id;
  return null;
end $$;
create trigger jornada_tareas_total after insert or update or delete on public.jornada_tareas
  for each row execute function public.tg_jornada_tareas_total();

-- Guardar una jornada completa (estado + tareas) en una transacción.
-- p: {empleado_id, fecha, estado, justificada, pago_adicional, nota,
--     tareas: [{tarea_id, cantidad, valor_unitario?}]}
create or replace function public.guardar_jornada(p jsonb)
returns bigint language plpgsql
as $$
declare v_id bigint; t jsonb;
begin
  perform public.exigir_rol('admin');
  insert into public.jornadas (empleado_id, fecha, estado, justificada, pago_adicional, nota)
  values ((p->>'empleado_id')::bigint, (p->>'fecha')::date, (p->>'estado')::public.estado_jornada,
          coalesce((p->>'justificada')::boolean, false), coalesce((p->>'pago_adicional')::numeric, 0), p->>'nota')
  on conflict (empleado_id, fecha) do update
     set estado = excluded.estado, justificada = excluded.justificada,
         pago_adicional = excluded.pago_adicional, nota = excluded.nota
  returning id into v_id;

  delete from public.jornada_tareas where jornada_id = v_id;
  for t in select * from jsonb_array_elements(coalesce(p->'tareas', '[]'::jsonb)) loop
    if coalesce((t->>'cantidad')::numeric, 0) > 0 then
      insert into public.jornada_tareas (jornada_id, tarea_id, cantidad, valor_unitario)
      values (v_id, (t->>'tarea_id')::bigint, (t->>'cantidad')::numeric,
              coalesce((t->>'valor_unitario')::numeric,
                       (select valor from public.tareas_nomina where id = (t->>'tarea_id')::bigint)));
    end if;
  end loop;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Abonos / adelantos (y liquidaciones al cerrar periodo)
-- ---------------------------------------------------------------------
create table public.abonos_empleados (
  id            bigint generated always as identity primary key,
  empleado_id   bigint not null references public.empleados(id),
  fecha         date not null default public.hoy(),
  monto         numeric(14,2) not null check (monto > 0),
  tipo          text not null default 'adelanto' check (tipo in ('adelanto', 'liquidacion')),
  entregado_por text,
  nota          text,
  periodo_id    bigint references public.periodos_nomina(id) on delete set null,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index abonos_empleados_idx on public.abonos_empleados (empleado_id, fecha);
create trigger abonos_empleados_auditar after insert or update or delete on public.abonos_empleados
  for each row execute function public.tg_auditar();

create or replace function public.tg_abono_empleado_periodo()
returns trigger language plpgsql as $$
begin
  if (tg_op <> 'INSERT' and public.fecha_en_periodo_cerrado(old.fecha) and old.tipo <> 'liquidacion')
     or (tg_op <> 'DELETE' and public.fecha_en_periodo_cerrado(new.fecha) and new.tipo <> 'liquidacion') then
    raise exception 'La fecha pertenece a un periodo de nómina cerrado.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger abonos_empleados_periodo before insert or update or delete on public.abonos_empleados
  for each row execute function public.tg_abono_empleado_periodo();

-- ---------------------------------------------------------------------
-- Resultado congelado del cierre por empleado
-- ---------------------------------------------------------------------
create table public.periodo_nomina_items (
  periodo_id     bigint not null references public.periodos_nomina(id) on delete cascade,
  empleado_id    bigint not null references public.empleados(id),
  dias_asistidos integer not null default 0,
  medias         integer not null default 0,
  faltas         integer not null default 0,
  total_dias     numeric(14,2) not null default 0,
  total_tareas   numeric(14,2) not null default 0,
  ganado         numeric(14,2) not null default 0,
  abonos         numeric(14,2) not null default 0,
  saldo_anterior numeric(14,2) not null default 0,
  neto           numeric(14,2) not null default 0,  -- saldo_anterior + ganado − abonos
  detalle        jsonb,                             -- tareas agrupadas
  primary key (periodo_id, empleado_id)
);

-- Cierra un periodo: congela lo ganado, descuenta abonos y (opcional)
-- registra la liquidación del neto para dejar el saldo en 0.
create or replace function public.cerrar_periodo_nomina(p_periodo_id bigint, p_liquidar boolean default false,
                                                        p_entregado_por text default null)
returns void language plpgsql
as $$
declare v_per public.periodos_nomina; r record;
begin
  perform public.exigir_rol('admin');
  select * into v_per from public.periodos_nomina where id = p_periodo_id for update;
  if v_per.id is null then raise exception 'Periodo no encontrado.'; end if;
  if v_per.estado = 'cerrado' then raise exception 'El periodo ya está cerrado.'; end if;

  delete from public.periodo_nomina_items where periodo_id = p_periodo_id;
  insert into public.periodo_nomina_items
    (periodo_id, empleado_id, dias_asistidos, medias, faltas, total_dias, total_tareas, ganado, abonos, saldo_anterior, neto, detalle)
  select p_periodo_id, e.id,
         coalesce(j.asistidos, 0), coalesce(j.medias, 0), coalesce(j.faltas, 0),
         coalesce(j.total_dias, 0), coalesce(j.total_tareas, 0), coalesce(j.ganado, 0),
         coalesce(a.abonos, 0), coalesce(s.saldo, 0),
         coalesce(s.saldo, 0) + coalesce(j.ganado, 0) - coalesce(a.abonos, 0),
         (select jsonb_agg(jsonb_build_object('tarea', t.nombre, 'unidad', t.unidad, 'cantidad', x.cant, 'monto', x.monto))
            from (select jt.tarea_id, sum(jt.cantidad) cant, sum(jt.subtotal) monto
                    from public.jornada_tareas jt join public.jornadas jj on jj.id = jt.jornada_id
                   where jj.empleado_id = e.id and jj.fecha between v_per.desde and v_per.hasta
                   group by jt.tarea_id) x join public.tareas_nomina t on t.id = x.tarea_id)
    from public.empleados e
    left join (select empleado_id,
                      count(*) filter (where estado in ('asistio', 'produccion')) asistidos,
                      count(*) filter (where estado = 'media') medias,
                      count(*) filter (where estado = 'no') faltas,
                      sum(pago_dia + pago_adicional) total_dias, sum(total_tareas) total_tareas, sum(ganado) ganado
                 from public.jornadas where fecha between v_per.desde and v_per.hasta group by empleado_id) j on j.empleado_id = e.id
    left join (select empleado_id, sum(monto) abonos from public.abonos_empleados
                where fecha between v_per.desde and v_per.hasta group by empleado_id) a on a.empleado_id = e.id
    left join (select x.empleado_id, sum(x.m) saldo from (
                 select empleado_id, ganado m from public.jornadas where fecha < v_per.desde
                 union all
                 select empleado_id, -monto from public.abonos_empleados where fecha < v_per.desde) x
               group by x.empleado_id) s on s.empleado_id = e.id
   where j.empleado_id is not null or a.empleado_id is not null or coalesce(s.saldo, 0) <> 0;

  update public.abonos_empleados set periodo_id = p_periodo_id
   where fecha between v_per.desde and v_per.hasta;

  if p_liquidar then
    for r in select empleado_id, neto from public.periodo_nomina_items
              where periodo_id = p_periodo_id and neto > 0 loop
      insert into public.abonos_empleados (empleado_id, fecha, monto, tipo, entregado_por, nota, periodo_id)
      values (r.empleado_id, v_per.hasta, r.neto, 'liquidacion', p_entregado_por,
              'Liquidación periodo ' || to_char(v_per.desde, 'DD/MM/YYYY') || ' – ' || to_char(v_per.hasta, 'DD/MM/YYYY'),
              p_periodo_id);
    end loop;
  end if;

  update public.periodos_nomina set estado = 'cerrado', cerrado_el = now(), cerrado_por = auth.uid()
   where id = p_periodo_id;
  perform public.auditar('CERRAR', 'periodos_nomina', p_periodo_id::text);
end $$;

create or replace function public.reabrir_periodo_nomina(p_periodo_id bigint, p_motivo text)
returns void language plpgsql
as $$
begin
  perform public.exigir_rol('admin');
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indique el motivo para reabrir.'; end if;
  update public.periodos_nomina set estado = 'abierto', cerrado_el = null, cerrado_por = null
   where id = p_periodo_id;
  -- Las liquidaciones automáticas se eliminan; se regeneran al volver a cerrar
  delete from public.abonos_empleados where periodo_id = p_periodo_id and tipo = 'liquidacion';
  update public.abonos_empleados set periodo_id = null where periodo_id = p_periodo_id;
  delete from public.periodo_nomina_items where periodo_id = p_periodo_id;
  perform public.auditar('REABRIR', 'periodos_nomina', p_periodo_id::text, null, null, p_motivo);
end $$;
