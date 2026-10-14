-- =====================================================================
-- Tierra Santa · 0002 · Catálogos: monedas, tasas, unidades, productos,
-- ubicaciones, métodos de pago.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Monedas y tasas de cambio
-- ---------------------------------------------------------------------
create table public.monedas (
  codigo    text primary key check (codigo ~ '^[A-Z]{3}$'),
  nombre    text not null,
  simbolo   text not null default '$',
  decimales smallint not null default 2 check (decimales between 0 and 4),
  activa    boolean not null default true,
  orden     smallint not null default 0
);

insert into public.monedas (codigo, nombre, simbolo, decimales, activa, orden) values
  ('USD', 'Dólar estadounidense', '$', 2, true, 1),
  ('COP', 'Peso colombiano', '$', 0, true, 2),
  ('VES', 'Bolívar', 'Bs', 2, false, 3);

alter table public.empresa
  add constraint empresa_moneda_fk foreign key (moneda_defecto) references public.monedas(codigo);

-- Tasa informativa: 1 unidad de moneda_origen = tasa unidades de moneda_destino.
-- Solo para reportes consolidados y conversiones explícitas; los saldos
-- nunca se convierten automáticamente.
create table public.tasas_cambio (
  id             bigint generated always as identity primary key,
  fecha          date not null,
  moneda_origen  text not null references public.monedas(codigo),
  moneda_destino text not null references public.monedas(codigo),
  tasa           numeric(18,6) not null check (tasa > 0),
  nota           text,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint tasas_distintas check (moneda_origen <> moneda_destino),
  constraint tasas_uk unique (fecha, moneda_origen, moneda_destino)
);
create index tasas_cambio_busqueda_idx on public.tasas_cambio (moneda_origen, moneda_destino, fecha desc);

-- Tasa vigente más reciente a una fecha (directa o inversa)
create or replace function public.tasa_en(p_origen text, p_destino text, p_fecha date default public.hoy())
returns numeric language sql stable
as $$
  select case when p_origen = p_destino then 1 else (
    select t from (
      select tasa as t, fecha from public.tasas_cambio
        where moneda_origen = p_origen and moneda_destino = p_destino and fecha <= p_fecha
      union all
      select 1 / tasa, fecha from public.tasas_cambio
        where moneda_origen = p_destino and moneda_destino = p_origen and fecha <= p_fecha
    ) x order by fecha desc limit 1)
  end
$$;

-- ---------------------------------------------------------------------
-- Unidades de medida
-- ---------------------------------------------------------------------
create table public.unidades (
  codigo  text primary key check (codigo ~ '^[a-z0-9_]{1,20}$'),
  nombre  text not null,
  plural  text not null,
  activa  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Ubicaciones / almacenes
-- ---------------------------------------------------------------------
create table public.ubicaciones (
  id            bigint generated always as identity primary key,
  nombre        text not null,
  descripcion   text,
  es_cuarto_frio boolean not null default false,
  predeterminada boolean not null default false,
  activa        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index ubicaciones_nombre_uk on public.ubicaciones (public.normalizar(nombre));
create unique index ubicaciones_predeterminada_uk on public.ubicaciones (predeterminada) where predeterminada;
create trigger ubicaciones_updated_at before update on public.ubicaciones
  for each row execute function public.tg_set_updated_at();
create trigger ubicaciones_auditar after insert or update or delete on public.ubicaciones
  for each row execute function public.tg_auditar();

alter table public.empresa
  add constraint empresa_entregas_ubicacion_fk foreign key (entregas_ubicacion_id) references public.ubicaciones(id);

-- Al marcar una ubicación como predeterminada, desmarca las demás
create or replace function public.tg_ubicacion_predeterminada()
returns trigger language plpgsql as $$
begin
  if new.predeterminada then
    update public.ubicaciones set predeterminada = false
      where id <> new.id and predeterminada;
  end if;
  return new;
end $$;
create trigger ubicaciones_predeterminada before insert or update of predeterminada on public.ubicaciones
  for each row when (new.predeterminada) execute function public.tg_ubicacion_predeterminada();

create or replace function public.ubicacion_predeterminada()
returns bigint language sql stable
as $$ select id from public.ubicaciones where activa order by predeterminada desc, id limit 1 $$;

-- ---------------------------------------------------------------------
-- Productos / rubros (catálogo único para clientes, proveedores e inventario)
-- ---------------------------------------------------------------------
create type public.tipo_producto as enum ('materia_prima', 'terminado', 'ambos');
create type public.modo_pesaje as enum ('FIJO', 'VARIABLE');

create table public.productos (
  id            bigint generated always as identity primary key,
  codigo        integer not null check (codigo > 0),   -- se teclea en la factura: 1 = Guanábana...
  nombre        text not null,
  emoji         text,
  unidad        text not null default 'kg' references public.unidades(codigo),
  tipo          public.tipo_producto not null default 'ambos',
  kg_por_cesta  numeric(10,3) check (kg_por_cesta is null or kg_por_cesta > 0),
  modo_pesaje   public.modo_pesaje not null default 'FIJO',
  stock_minimo  numeric(14,3) not null default 0 check (stock_minimo >= 0),
  activo        boolean not null default true,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint productos_codigo_uk unique (codigo),
  constraint productos_fijo_requiere_kg check (modo_pesaje = 'VARIABLE' or kg_por_cesta is not null or tipo = 'terminado')
);
create unique index productos_nombre_uk on public.productos (public.normalizar(nombre));
create index productos_nombre_trgm on public.productos using gin (public.normalizar(nombre) extensions.gin_trgm_ops);
create trigger productos_updated_at before update on public.productos
  for each row execute function public.tg_set_updated_at();
create trigger productos_auditar after insert or update or delete on public.productos
  for each row execute function public.tg_auditar();

-- ---------------------------------------------------------------------
-- Métodos de pago (editables)
-- ---------------------------------------------------------------------
create table public.metodos_pago (
  id      bigint generated always as identity primary key,
  nombre  text not null,
  activo  boolean not null default true,
  orden   smallint not null default 0
);
create unique index metodos_pago_nombre_uk on public.metodos_pago (public.normalizar(nombre));
create trigger metodos_pago_auditar after insert or update or delete on public.metodos_pago
  for each row execute function public.tg_auditar();
