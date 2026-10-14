-- =====================================================================
-- Tierra Santa · 0004 · Proveedores unificados (COP + USD):
-- entregas FIJO/VARIABLE con merma, abonos y cestas.
-- =====================================================================

create table public.proveedores (
  id              bigint generated always as identity primary key,
  nombre          text not null check (length(trim(nombre)) > 0),
  documento       text,                 -- cédula / RIF / NIT
  telefono        text,
  ubicacion       text,                 -- finca / zona
  moneda_habitual text not null default 'COP' references public.monedas(codigo),
  notas           text,
  activo          boolean not null default true,
  search          text generated always as (public.normalizar(nombre || ' ' || coalesce(documento, ''))) stored,
  created_by      uuid references public.profiles(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index proveedores_nombre_uk on public.proveedores (public.normalizar(nombre));
create index proveedores_search_trgm on public.proveedores using gin (search extensions.gin_trgm_ops);
create trigger proveedores_updated_at before update on public.proveedores
  for each row execute function public.tg_set_updated_at();
create trigger proveedores_auditar after insert or update or delete on public.proveedores
  for each row execute function public.tg_auditar();

-- ---------------------------------------------------------------------
-- Entregas (compras de fruta)
-- ---------------------------------------------------------------------
create table public.entregas_proveedor (
  id            bigint generated always as identity primary key,
  proveedor_id  bigint not null references public.proveedores(id),
  fecha         date not null default public.hoy(),
  producto_id   bigint not null references public.productos(id),
  moneda        text not null references public.monedas(codigo),
  -- Copia de la configuración del rubro al momento de la entrega
  modo_pesaje   public.modo_pesaje not null,
  kg_por_cesta  numeric(10,3),
  -- Datos ingresados
  cestas        numeric(10,2) not null default 0 check (cestas >= 0),
  kg_total      numeric(12,3) not null default 0 check (kg_total >= 0),  -- calculado en FIJO, ingresado en VARIABLE
  precio        numeric(14,2) not null check (precio >= 0),              -- FIJO: precio por cesta · VARIABLE: precio total
  merma         numeric(12,3) not null default 0 check (merma >= 0),     -- kg
  foto_url      text,
  foto_path     text,
  nota          text,
  -- Calculados por trigger
  precio_kg     numeric(14,4) not null default 0,
  desc_merma    numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  peso_neto     numeric(12,3) not null default 0,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index entregas_proveedor_idx on public.entregas_proveedor (proveedor_id, fecha);
create index entregas_fecha_idx on public.entregas_proveedor (fecha desc);
create index entregas_producto_idx on public.entregas_proveedor (producto_id, fecha);
create trigger entregas_updated_at before update on public.entregas_proveedor
  for each row execute function public.tg_set_updated_at();
create trigger entregas_auditar after insert or update or delete on public.entregas_proveedor
  for each row execute function public.tg_auditar();

-- Fórmulas exactas del sistema anterior:
--  FIJO:     kg_total = cestas × kg_por_cesta; precio_kg = precio_cesta / kg_por_cesta;
--            desc_merma = merma × precio_kg;  total = cestas × precio_cesta − desc_merma
--  VARIABLE: kg_total ingresado; precio = precio total de la entrega;
--            precio_kg = precio / kg_total;  desc_merma = merma × precio_kg; total = precio − desc_merma
--  peso_neto = kg_total − merma
create or replace function public.calcular_entrega(
  p_modo public.modo_pesaje, p_kg_por_cesta numeric, p_cestas numeric,
  p_kg_total numeric, p_precio numeric, p_merma numeric,
  out kg_total numeric, out precio_kg numeric, out desc_merma numeric,
  out total numeric, out peso_neto numeric)
language plpgsql immutable
as $$
begin
  if p_modo = 'FIJO' then
    if coalesce(p_kg_por_cesta, 0) <= 0 then
      raise exception 'El rubro FIJO requiere kg por cesta mayor a 0.';
    end if;
    kg_total   := round(coalesce(p_cestas, 0) * p_kg_por_cesta, 3);
    precio_kg  := round(p_precio / p_kg_por_cesta, 4);
    desc_merma := round(coalesce(p_merma, 0) * p_precio / p_kg_por_cesta, 2);
    total      := round(coalesce(p_cestas, 0) * p_precio, 2) - desc_merma;
  else
    if coalesce(p_kg_total, 0) <= 0 then
      raise exception 'El rubro VARIABLE requiere el total de kg mayor a 0.';
    end if;
    kg_total   := p_kg_total;
    precio_kg  := round(p_precio / p_kg_total, 4);
    desc_merma := round(coalesce(p_merma, 0) * p_precio / p_kg_total, 2);
    total      := p_precio - desc_merma;
  end if;
  if coalesce(p_merma, 0) > kg_total then
    raise exception 'La merma (% kg) no puede superar el peso total (% kg).', p_merma, kg_total;
  end if;
  peso_neto := kg_total - coalesce(p_merma, 0);
end $$;

create or replace function public.tg_entrega_calcular()
returns trigger language plpgsql as $$
declare v_prod public.productos; r record;
begin
  -- Al crear (o si cambia el rubro) se copia la configuración del producto
  if tg_op = 'INSERT' or new.producto_id <> old.producto_id then
    select * into v_prod from public.productos where id = new.producto_id;
    if new.modo_pesaje is null or (tg_op = 'UPDATE') then
      new.modo_pesaje := v_prod.modo_pesaje;
    end if;
    if new.kg_por_cesta is null or (tg_op = 'UPDATE') then
      new.kg_por_cesta := v_prod.kg_por_cesta;
    end if;
  end if;
  select * into r from public.calcular_entrega(new.modo_pesaje, new.kg_por_cesta, new.cestas,
                                               new.kg_total, new.precio, new.merma);
  new.kg_total := r.kg_total; new.precio_kg := r.precio_kg; new.desc_merma := r.desc_merma;
  new.total := r.total; new.peso_neto := r.peso_neto;
  return new;
end $$;
create trigger entregas_calcular before insert or update on public.entregas_proveedor
  for each row execute function public.tg_entrega_calcular();

-- ---------------------------------------------------------------------
-- Abonos / pagos a proveedores
-- ---------------------------------------------------------------------
create table public.abonos_proveedor (
  id           bigint generated always as identity primary key,
  numero       bigint not null default public.siguiente_numero('recibo_proveedor'),
  proveedor_id bigint not null references public.proveedores(id),
  fecha        date not null default public.hoy(),
  moneda       text not null references public.monedas(codigo),
  monto        numeric(14,2) not null check (monto > 0),
  metodo_id    bigint references public.metodos_pago(id),
  referencia   text,
  pagado_por   text,                 -- quién entregó el dinero
  nota         text,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint abonos_proveedor_numero_uk unique (numero)
);
create index abonos_proveedor_idx on public.abonos_proveedor (proveedor_id, moneda, fecha);
create index abonos_proveedor_fecha_idx on public.abonos_proveedor (fecha desc);
create trigger abonos_proveedor_updated_at before update on public.abonos_proveedor
  for each row execute function public.tg_set_updated_at();
create trigger abonos_proveedor_auditar after insert or update or delete on public.abonos_proveedor
  for each row execute function public.tg_auditar();

-- ---------------------------------------------------------------------
-- Cestas entregadas / devueltas
-- ---------------------------------------------------------------------
create table public.cestas_proveedor (
  id           bigint generated always as identity primary key,
  proveedor_id bigint not null references public.proveedores(id),
  fecha        date not null default public.hoy(),
  entregadas   integer not null default 0 check (entregadas >= 0),
  devueltas    integer not null default 0 check (devueltas >= 0),
  entrega_id   bigint references public.entregas_proveedor(id) on delete set null,
  nota         text,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint cestas_algo check (entregadas + devueltas > 0)
);
create index cestas_proveedor_idx on public.cestas_proveedor (proveedor_id, fecha);
create trigger cestas_proveedor_auditar after insert or update or delete on public.cestas_proveedor
  for each row execute function public.tg_auditar();
