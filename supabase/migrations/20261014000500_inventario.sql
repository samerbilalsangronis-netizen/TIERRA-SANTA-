-- =====================================================================
-- Tierra Santa · 0005 · Inventario basado en movimientos (libro mayor).
-- El stock nunca se sobreescribe: existencias = Σ movimientos, mantenida
-- por trigger en la tabla "existencias" para lecturas rápidas.
--
-- "forma" separa materia prima (MP, fruta recibida) de producto terminado
-- (PT, pulpa) para un mismo código de producto de tipo "ambos".
-- =====================================================================

create type public.forma_inventario as enum ('MP', 'PT');
create type public.tipo_movimiento as enum (
  'produccion',          -- entrada de producto terminado
  'consumo_produccion',  -- salida de materia prima usada en producción
  'compra',              -- entrada automática desde entregas de proveedores
  'venta',               -- salida automática por factura (o ajuste por edición)
  'reverso_venta',       -- entrada por anulación/edición de factura
  'merma',               -- merma / daño / vencimiento
  'ajuste',              -- ajuste por conteo físico (solo admin)
  'traslado_salida',
  'traslado_entrada',
  'inicial'              -- saldo inicial / migración
);

-- ---------------------------------------------------------------------
-- Lotes (opcionales, activables en Configuración)
-- ---------------------------------------------------------------------
create table public.lotes (
  id               bigint generated always as identity primary key,
  producto_id      bigint not null references public.productos(id),
  codigo           text not null,
  fecha_produccion date not null default public.hoy(),
  vence_el         date,
  nota             text,
  created_at       timestamptz not null default now(),
  constraint lotes_uk unique (producto_id, codigo)
);
create index lotes_fifo_idx on public.lotes (producto_id, fecha_produccion, id);

-- ---------------------------------------------------------------------
-- Producciones (cabecera del registro diario)
-- ---------------------------------------------------------------------
create table public.producciones (
  id           bigint generated always as identity primary key,
  fecha        date not null default public.hoy(),
  ubicacion_id bigint not null references public.ubicaciones(id),
  responsable  text,
  nota         text,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index producciones_fecha_idx on public.producciones (fecha desc);

-- ---------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------
create table public.movimientos_inventario (
  id               bigint generated always as identity primary key,
  fecha            timestamptz not null default now(),
  producto_id      bigint not null references public.productos(id),
  ubicacion_id     bigint not null references public.ubicaciones(id),
  forma            public.forma_inventario not null default 'PT',
  tipo             public.tipo_movimiento not null,
  cantidad         numeric(14,3) not null check (cantidad <> 0),  -- + entra / − sale
  lote_id          bigint references public.lotes(id),
  factura_id       bigint references public.facturas(id) on delete set null,
  entrega_id       bigint references public.entregas_proveedor(id) on delete set null,
  produccion_id    bigint references public.producciones(id) on delete cascade,
  traslado_id      uuid,                   -- enlaza salida y entrada de un traslado
  nota             text,
  created_by       uuid references public.profiles(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index movimientos_producto_idx on public.movimientos_inventario (producto_id, fecha);
create index movimientos_ubicacion_idx on public.movimientos_inventario (ubicacion_id, producto_id, fecha);
create index movimientos_tipo_idx on public.movimientos_inventario (tipo, fecha);
create index movimientos_factura_idx on public.movimientos_inventario (factura_id) where factura_id is not null;
create index movimientos_entrega_idx on public.movimientos_inventario (entrega_id) where entrega_id is not null;
create index movimientos_traslado_idx on public.movimientos_inventario (traslado_id) where traslado_id is not null;

-- Existencias mantenidas por trigger
create table public.existencias (
  producto_id  bigint not null references public.productos(id),
  ubicacion_id bigint not null references public.ubicaciones(id),
  forma        public.forma_inventario not null,
  lote_id      bigint references public.lotes(id),
  cantidad     numeric(14,3) not null default 0,
  actualizado  timestamptz not null default now()
);
create unique index existencias_uk on public.existencias (producto_id, ubicacion_id, forma, coalesce(lote_id, 0));
create index existencias_ubicacion_idx on public.existencias (ubicacion_id);

create or replace function public.tg_movimiento_existencias()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare r record; v_signo int;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Los movimientos de inventario no se editan: registre un movimiento de corrección.';
  end if;
  if tg_op = 'INSERT' then r := new; v_signo := 1; else r := old; v_signo := -1; end if;
  insert into public.existencias as e (producto_id, ubicacion_id, forma, lote_id, cantidad)
  values (r.producto_id, r.ubicacion_id, r.forma, r.lote_id, v_signo * r.cantidad)
  on conflict (producto_id, ubicacion_id, forma, coalesce(lote_id, 0))
  do update set cantidad = e.cantidad + excluded.cantidad, actualizado = now();
  return null;
end $$;
create trigger movimientos_existencias after insert or update or delete on public.movimientos_inventario
  for each row execute function public.tg_movimiento_existencias();
create trigger movimientos_auditar after delete on public.movimientos_inventario
  for each row execute function public.tg_auditar();

-- Forma con la que se vende / compra un producto
create or replace function public.forma_venta(p_producto_id bigint)
returns public.forma_inventario language sql stable
as $$ select case when tipo = 'materia_prima' then 'MP'::public.forma_inventario else 'PT' end
      from public.productos where id = p_producto_id $$;

create or replace function public.forma_compra(p_producto_id bigint)
returns public.forma_inventario language sql stable
as $$ select case when tipo = 'terminado' then 'PT'::public.forma_inventario else 'MP' end
      from public.productos where id = p_producto_id $$;

-- Stock disponible de un producto (todas las formas indicadas) en una ubicación
create or replace function public.stock_disponible(
  p_producto_id bigint, p_ubicacion_id bigint default null, p_forma public.forma_inventario default null)
returns numeric language sql stable
as $$
  select coalesce(sum(cantidad), 0) from public.existencias
   where producto_id = p_producto_id
     and (p_ubicacion_id is null or ubicacion_id = p_ubicacion_id)
     and (p_forma is null or forma = p_forma)
$$;

-- ---------------------------------------------------------------------
-- Helpers de salida / devolución (FIFO por lote si los lotes están activos)
-- ---------------------------------------------------------------------
create or replace function public.inv_salida(
  p_producto_id bigint, p_ubicacion_id bigint, p_forma public.forma_inventario,
  p_cantidad numeric, p_tipo public.tipo_movimiento, p_fecha timestamptz default now(),
  p_factura_id bigint default null, p_entrega_id bigint default null,
  p_produccion_id bigint default null, p_traslado_id uuid default null, p_nota text default null)
returns void language plpgsql
as $$
declare
  v_restante numeric := p_cantidad; v_lotes boolean; r record; v_toma numeric;
begin
  if p_cantidad <= 0 then return; end if;
  select lotes_activos into v_lotes from public.empresa where id = 1;
  if v_lotes then
    for r in
      select e.lote_id, e.cantidad from public.existencias e
        join public.lotes l on l.id = e.lote_id
       where e.producto_id = p_producto_id and e.ubicacion_id = p_ubicacion_id
         and e.forma = p_forma and e.cantidad > 0
       order by l.fecha_produccion, l.id
    loop
      exit when v_restante <= 0;
      v_toma := least(v_restante, r.cantidad);
      insert into public.movimientos_inventario
        (fecha, producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, factura_id, entrega_id, produccion_id, traslado_id, nota)
      values (p_fecha, p_producto_id, p_ubicacion_id, p_forma, p_tipo, -v_toma, r.lote_id, p_factura_id, p_entrega_id, p_produccion_id, p_traslado_id, p_nota);
      v_restante := v_restante - v_toma;
    end loop;
  end if;
  if v_restante > 0 then
    insert into public.movimientos_inventario
      (fecha, producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, factura_id, entrega_id, produccion_id, traslado_id, nota)
    values (p_fecha, p_producto_id, p_ubicacion_id, p_forma, p_tipo, -v_restante, null, p_factura_id, p_entrega_id, p_produccion_id, p_traslado_id, p_nota);
  end if;
end $$;

-- Ajusta lo que una factura tiene descontado de (producto, ubicación) a p_objetivo.
-- Si hay que descontar más, usa FIFO; si hay que devolver, devuelve a los
-- mismos lotes que consumió la factura (los más recientes primero).
create or replace function public.inv_ajustar_factura(
  p_factura_id bigint, p_producto_id bigint, p_ubicacion_id bigint,
  p_objetivo numeric, p_nota text default null)
returns void language plpgsql
as $$
declare
  v_forma public.forma_inventario := public.forma_venta(p_producto_id);
  v_actual numeric; v_dif numeric; r record; v_dev numeric;
begin
  select coalesce(-sum(cantidad), 0) into v_actual from public.movimientos_inventario
   where factura_id = p_factura_id and producto_id = p_producto_id and ubicacion_id = p_ubicacion_id;
  v_dif := p_objetivo - v_actual;
  if v_dif > 0 then
    perform public.inv_salida(p_producto_id, p_ubicacion_id, v_forma, v_dif, 'venta', now(), p_factura_id, p_nota => p_nota);
  elsif v_dif < 0 then
    v_dif := -v_dif;
    for r in
      select lote_id, forma, -sum(cantidad) as neto, max(id) as ult
        from public.movimientos_inventario
       where factura_id = p_factura_id and producto_id = p_producto_id and ubicacion_id = p_ubicacion_id
       group by lote_id, forma having -sum(cantidad) > 0
       order by max(id) desc
    loop
      exit when v_dif <= 0;
      v_dev := least(v_dif, r.neto);
      insert into public.movimientos_inventario
        (producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, factura_id, nota)
      values (p_producto_id, p_ubicacion_id, r.forma, 'reverso_venta', v_dev, r.lote_id, p_factura_id, p_nota);
      v_dif := v_dif - v_dev;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Operaciones de inventario (transaccionales)
-- ---------------------------------------------------------------------

-- Registrar producción del día: p_items = [{producto_id, cantidad, lote?, consumo_mp?}]
--  consumo_mp (opcional): kg de materia prima del mismo producto a descontar.
create or replace function public.registrar_produccion(
  p_fecha date, p_ubicacion_id bigint, p_items jsonb,
  p_responsable text default null, p_nota text default null)
returns bigint language plpgsql
as $$
declare
  v_id bigint; it jsonb; v_lote_id bigint; v_lotes boolean; v_ts timestamptz;
begin
  perform public.exigir_rol('admin', 'operador', 'facturacion');
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Agregue al menos un producto.';
  end if;
  select lotes_activos into v_lotes from public.empresa where id = 1;
  v_ts := (p_fecha::timestamp + (now() at time zone 'America/Caracas')::time) at time zone 'America/Caracas';
  insert into public.producciones (fecha, ubicacion_id, responsable, nota)
  values (p_fecha, p_ubicacion_id, p_responsable, p_nota) returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce((it->>'cantidad')::numeric, 0) <= 0 then continue; end if;
    v_lote_id := null;
    if v_lotes then
      insert into public.lotes (producto_id, codigo, fecha_produccion)
      values ((it->>'producto_id')::bigint,
              coalesce(nullif(it->>'lote', ''), to_char(p_fecha, 'YYYYMMDD') || '-' || v_id),
              p_fecha)
      on conflict (producto_id, codigo) do update set codigo = excluded.codigo
      returning id into v_lote_id;
    end if;
    insert into public.movimientos_inventario
      (fecha, producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, produccion_id, nota)
    values (v_ts, (it->>'producto_id')::bigint, p_ubicacion_id, 'PT', 'produccion',
            (it->>'cantidad')::numeric, v_lote_id, v_id, p_nota);
    if coalesce((it->>'consumo_mp')::numeric, 0) > 0 then
      perform public.inv_salida((it->>'producto_id')::bigint, p_ubicacion_id, 'MP',
        (it->>'consumo_mp')::numeric, 'consumo_produccion', v_ts, p_produccion_id => v_id, p_nota => p_nota);
    end if;
  end loop;
  perform public.auditar('CREAR', 'producciones', v_id::text, null, p_items, p_nota);
  return v_id;
end $$;

-- Traslado entre ubicaciones (salida y entrada enlazadas por traslado_id)
create or replace function public.trasladar_inventario(
  p_producto_id bigint, p_forma public.forma_inventario, p_origen bigint, p_destino bigint,
  p_cantidad numeric, p_nota text default null)
returns uuid language plpgsql
as $$
declare v_id uuid := gen_random_uuid(); r record;
begin
  perform public.exigir_rol('admin', 'operador', 'facturacion');
  if p_origen = p_destino then raise exception 'El origen y el destino deben ser distintos.'; end if;
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a 0.'; end if;
  perform public.inv_salida(p_producto_id, p_origen, p_forma, p_cantidad, 'traslado_salida',
                            p_traslado_id => v_id, p_nota => p_nota);
  -- La entrada replica los lotes que salieron
  for r in select lote_id, -cantidad as cant from public.movimientos_inventario where traslado_id = v_id loop
    insert into public.movimientos_inventario
      (producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, traslado_id, nota)
    values (p_producto_id, p_destino, p_forma, 'traslado_entrada', r.cant, r.lote_id, v_id, p_nota);
  end loop;
  return v_id;
end $$;

-- Ajuste por conteo físico: deja el stock en p_conteo (solo admin)
create or replace function public.ajustar_inventario(
  p_producto_id bigint, p_ubicacion_id bigint, p_forma public.forma_inventario,
  p_conteo numeric, p_motivo text)
returns numeric language plpgsql
as $$
declare v_actual numeric; v_dif numeric;
begin
  perform public.exigir_rol('admin');
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indique el motivo del ajuste.'; end if;
  v_actual := public.stock_disponible(p_producto_id, p_ubicacion_id, p_forma);
  v_dif := p_conteo - v_actual;
  if v_dif <> 0 then
    insert into public.movimientos_inventario (producto_id, ubicacion_id, forma, tipo, cantidad, nota)
    values (p_producto_id, p_ubicacion_id, p_forma, 'ajuste', v_dif, p_motivo);
    perform public.auditar('AJUSTE', 'existencias', p_producto_id::text,
      jsonb_build_object('cantidad', v_actual), jsonb_build_object('cantidad', p_conteo), p_motivo);
  end if;
  return v_dif;
end $$;

-- Merma / daño / vencimiento
create or replace function public.registrar_merma_inventario(
  p_producto_id bigint, p_ubicacion_id bigint, p_forma public.forma_inventario,
  p_cantidad numeric, p_motivo text)
returns void language plpgsql
as $$
begin
  perform public.exigir_rol('admin', 'operador', 'facturacion');
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a 0.'; end if;
  perform public.inv_salida(p_producto_id, p_ubicacion_id, p_forma, p_cantidad, 'merma', p_nota => p_motivo);
end $$;

-- ---------------------------------------------------------------------
-- Entradas automáticas desde entregas de proveedores (si está activado)
-- ---------------------------------------------------------------------
create or replace function public.tg_entrega_inventario()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_activo boolean; v_ubic bigint; r record;
begin
  select entregas_suman_inventario, coalesce(entregas_ubicacion_id, public.ubicacion_predeterminada())
    into v_activo, v_ubic from public.empresa where id = 1;

  -- Revertir lo que esta entrega tenga registrado (si cambió algo relevante o se borra)
  if tg_op in ('UPDATE', 'DELETE') then
    if tg_op = 'DELETE' or old.producto_id <> new.producto_id or old.peso_neto <> new.peso_neto or old.fecha <> new.fecha then
      for r in select producto_id, ubicacion_id, forma, lote_id, sum(cantidad) as neto
                 from public.movimientos_inventario where entrega_id = old.id
                group by 1, 2, 3, 4 having sum(cantidad) <> 0 loop
        insert into public.movimientos_inventario (producto_id, ubicacion_id, forma, tipo, cantidad, lote_id, entrega_id, nota)
        values (r.producto_id, r.ubicacion_id, r.forma, 'compra', -r.neto, r.lote_id, old.id,
                case when tg_op = 'DELETE' then 'Reverso por entrega eliminada' else 'Reverso por edición de entrega' end);
      end loop;
    else
      return new;  -- nada relevante cambió
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and v_activo and v_ubic is not null and new.peso_neto > 0 then
    insert into public.movimientos_inventario (fecha, producto_id, ubicacion_id, forma, tipo, cantidad, entrega_id, nota)
    values ((new.fecha::timestamp + time '12:00') at time zone 'America/Caracas',
            new.producto_id, v_ubic, public.forma_compra(new.producto_id), 'compra', new.peso_neto, new.id,
            'Entrega de proveedor');
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger entregas_inventario_iu after insert or update on public.entregas_proveedor
  for each row execute function public.tg_entrega_inventario();
create trigger entregas_inventario_d before delete on public.entregas_proveedor
  for each row execute function public.tg_entrega_inventario();
