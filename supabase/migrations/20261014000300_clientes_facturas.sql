-- =====================================================================
-- Tierra Santa · 0003 · Clientes, facturas, pagos aplicados por factura,
-- versiones de factura y control de empaques/cajas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clientes (
  id             bigint generated always as identity primary key,
  numero         integer check (numero > 0),   -- nº de cliente (consecutivo, editable por admin; lo asigna un trigger si viene vacío)
  nombre         text not null check (length(trim(nombre)) > 0),
  documento      text,                                   -- cédula / RIF / NIT
  telefono       text,
  direccion      text,
  correo         text,
  notas          text,
  limite_credito numeric(14,2) check (limite_credito is null or limite_credito >= 0),
  limite_moneda  text references public.monedas(codigo),
  activo         boolean not null default true,
  search         text generated always as (
                   public.normalizar(nombre || ' ' || coalesce(documento, '') || ' ' || numero::text)
                 ) stored,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint clientes_numero_uk unique (numero),
  constraint clientes_numero_nn check (numero is not null)
);
create index clientes_search_trgm on public.clientes using gin (search extensions.gin_trgm_ops);
create index clientes_nombre_idx on public.clientes (public.normalizar(nombre));
create index clientes_documento_idx on public.clientes (documento);
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tg_set_updated_at();
create trigger clientes_auditar after insert or update or delete on public.clientes
  for each row execute function public.tg_auditar();

-- Número de cliente automático si no se indica; el contador sigue al máximo.
create or replace function public.tg_cliente_numero()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    new.numero := public.siguiente_numero('cliente');
    while exists (select 1 from public.clientes where numero = new.numero) loop
      new.numero := public.siguiente_numero('cliente');
    end loop;
  else
    update public.contadores set valor = greatest(valor, new.numero) where clave = 'cliente';
  end if;
  if tg_op = 'UPDATE' and new.numero is distinct from old.numero and auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar el número de cliente.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger clientes_numero before insert or update of numero on public.clientes
  for each row execute function public.tg_cliente_numero();

-- ---------------------------------------------------------------------
-- Facturas
-- ---------------------------------------------------------------------
create type public.estado_factura as enum ('borrador', 'emitida', 'anulada');
create type public.origen_factura as enum ('sistema', 'externa');
create type public.condicion_pago as enum ('contado', 'credito');

create table public.facturas (
  id                bigint generated always as identity primary key,
  origen            public.origen_factura not null default 'sistema',
  numero            bigint,                         -- consecutivo del sistema (sin huecos)
  numero_externo    text,                           -- nº de facturas históricas/externas
  estado            public.estado_factura not null default 'borrador',
  cliente_id        bigint not null references public.clientes(id),
  fecha             date not null default public.hoy(),
  moneda            text not null references public.monedas(codigo),
  condicion         public.condicion_pago not null default 'credito',
  ubicacion_id      bigint references public.ubicaciones(id),
  observaciones     text,
  iva_pct           numeric(5,2) not null default 16 check (iva_pct >= 0 and iva_pct <= 100),
  -- Copia de los datos del cliente al emitir/editar (para el documento impreso)
  cliente_numero    integer,
  cliente_nombre    text,
  cliente_documento text,
  cliente_telefono  text,
  cliente_direccion text,
  -- Totales (los calcula la función de emisión/edición)
  base_imponible    numeric(14,2) not null default 0,
  exento            numeric(14,2) not null default 0,
  subtotal          numeric(14,2) not null default 0,
  iva               numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0 check (total >= 0),
  pagado            numeric(14,2) not null default 0 check (pagado >= 0),
  saldo             numeric(14,2) generated always as (
                      case when estado = 'emitida' then total - pagado else 0 end) stored,
  estado_pago       text generated always as (
                      case
                        when estado = 'anulada' then 'anulada'
                        when estado = 'borrador' then 'borrador'
                        when pagado <= 0 and total > 0 then 'pendiente'
                        when pagado < total then 'abonada'
                        else 'pagada'
                      end) stored,
  -- Soporte (facturas externas o PDF archivado)
  soporte_url       text,
  soporte_path      text,
  -- Anulación
  anulada_el        timestamptz,
  anulada_por       uuid references public.profiles(id),
  motivo_anulacion  text,
  version           integer not null default 0,
  emitida_el        timestamptz,
  emitida_por       uuid references public.profiles(id),
  created_by        uuid references public.profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint facturas_numero_uk unique (numero),
  constraint facturas_numero_sistema check (
    origen = 'externa' or estado = 'borrador' or numero is not null),
  constraint facturas_externa_emitida check (origen = 'sistema' or estado <> 'borrador'),
  constraint facturas_anulacion check (estado <> 'anulada' or motivo_anulacion is not null)
);
create index facturas_cliente_idx on public.facturas (cliente_id, fecha desc);
create index facturas_fecha_idx on public.facturas (fecha desc);
create index facturas_estado_idx on public.facturas (estado, estado_pago);
create index facturas_pendientes_idx on public.facturas (cliente_id, moneda, fecha) where saldo > 0;
create index facturas_numero_externo_idx on public.facturas (numero_externo) where numero_externo is not null;
create trigger facturas_updated_at before update on public.facturas
  for each row execute function public.tg_set_updated_at();

-- pagado ≤ total, verificado al final de la transacción (las funciones de edición
-- pueden bajar el total y luego liberar el exceso de pagos)
create or replace function public.tg_factura_validar_pagado()
returns trigger language plpgsql as $$
declare v public.facturas;
begin
  select * into v from public.facturas where id = new.id;
  if v.estado = 'emitida' and v.pagado > v.total then
    raise exception 'La factura % quedaría con pagos (%) mayores a su total (%).',
      coalesce(v.numero::text, v.numero_externo, v.id::text), v.pagado, v.total;
  end if;
  return null;
end $$;
create constraint trigger facturas_validar_pagado after insert or update on public.facturas
  deferrable initially deferred
  for each row execute function public.tg_factura_validar_pagado();

create table public.factura_lineas (
  id              bigint generated always as identity primary key,
  factura_id      bigint not null references public.facturas(id) on delete cascade,
  orden           smallint not null default 0,
  producto_id     bigint not null references public.productos(id),
  codigo          integer not null,                 -- copia del código al facturar
  descripcion     text not null,
  unidad          text not null,
  cantidad        numeric(14,3) not null check (cantidad > 0),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0),
  aplica_iva      boolean not null default false,
  total_linea     numeric(14,2) not null default 0
);
create index factura_lineas_factura_idx on public.factura_lineas (factura_id, orden);
create index factura_lineas_producto_idx on public.factura_lineas (producto_id);

-- Historial de versiones (instantánea completa de cabecera + líneas)
create table public.factura_versiones (
  id          bigint generated always as identity primary key,
  factura_id  bigint not null references public.facturas(id) on delete cascade,
  version     integer not null,
  accion      text not null,                         -- EMITIR, EDITAR, ANULAR
  snapshot    jsonb not null,
  cambios     jsonb,                                 -- resumen de diferencias con la versión anterior
  motivo      text,
  created_by  uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint factura_versiones_uk unique (factura_id, version)
);

-- ---------------------------------------------------------------------
-- Pagos de clientes (recibos) y su aplicación factura por factura
-- ---------------------------------------------------------------------
create type public.tipo_pago_cliente as enum ('pago', 'conversion');

create table public.pagos_clientes (
  id          bigint generated always as identity primary key,
  numero      bigint not null default public.siguiente_numero('recibo_cliente'), -- nº de recibo
  cliente_id  bigint not null references public.clientes(id),
  fecha       date not null default public.hoy(),
  moneda      text not null references public.monedas(codigo),
  monto       numeric(14,2) not null,
  tipo        public.tipo_pago_cliente not null default 'pago',
  metodo_id   bigint references public.metodos_pago(id),
  referencia  text,
  nota        text,
  pago_origen_id bigint references public.pagos_clientes(id) on delete cascade, -- para conversiones
  tasa_conversion numeric(18,6),
  created_by  uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pagos_clientes_monto check ((tipo = 'pago' and monto > 0) or (tipo = 'conversion' and monto <> 0)),
  constraint pagos_clientes_numero_uk unique (numero)
);
create index pagos_clientes_cliente_idx on public.pagos_clientes (cliente_id, moneda, fecha);
create index pagos_clientes_fecha_idx on public.pagos_clientes (fecha desc);
create trigger pagos_clientes_updated_at before update on public.pagos_clientes
  for each row execute function public.tg_set_updated_at();
create trigger pagos_clientes_auditar after insert or update or delete on public.pagos_clientes
  for each row execute function public.tg_auditar();

create table public.pago_aplicaciones (
  id          bigint generated always as identity primary key,
  pago_id     bigint not null references public.pagos_clientes(id) on delete cascade,
  factura_id  bigint not null references public.facturas(id) on delete cascade,
  monto       numeric(14,2) not null check (monto > 0),
  created_at  timestamptz not null default now(),
  constraint pago_aplicaciones_uk unique (pago_id, factura_id)
);
create index pago_aplicaciones_factura_idx on public.pago_aplicaciones (factura_id);
create trigger pago_aplicaciones_auditar after insert or update or delete on public.pago_aplicaciones
  for each row execute function public.tg_auditar();

-- Recalcula facturas.pagado
create or replace function public.recalcular_pagado(p_factura_id bigint)
returns void language sql
as $$
  update public.facturas f
     set pagado = coalesce((select sum(monto) from public.pago_aplicaciones where factura_id = f.id), 0)
   where f.id = p_factura_id
$$;

create or replace function public.tg_aplicacion_pagado()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalcular_pagado(new.factura_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or old.factura_id <> new.factura_id) then
    perform public.recalcular_pagado(old.factura_id);
  end if;
  return null;
end $$;
create trigger pago_aplicaciones_pagado after insert or update or delete on public.pago_aplicaciones
  for each row execute function public.tg_aplicacion_pagado();

-- Validaciones de consistencia (diferidas al final de la transacción para
-- permitir reacomodos dentro de las funciones de pago/edición).
create or replace function public.tg_aplicacion_validar()
returns trigger language plpgsql as $$
declare
  v_pago public.pagos_clientes; v_fact public.facturas; v_aplicado numeric;
begin
  -- puede haber sido borrada en la misma transacción
  if not exists (select 1 from public.pago_aplicaciones where id = new.id) then return null; end if;
  select * into v_pago from public.pagos_clientes where id = new.pago_id;
  select * into v_fact from public.facturas where id = new.factura_id;
  if v_fact.estado <> 'emitida' then
    raise exception 'Solo se pueden aplicar pagos a facturas emitidas (factura %).', coalesce(v_fact.numero::text, v_fact.numero_externo);
  end if;
  if v_pago.moneda <> v_fact.moneda then
    raise exception 'Un pago en % no puede aplicarse a una factura en %.', v_pago.moneda, v_fact.moneda;
  end if;
  if v_pago.cliente_id <> v_fact.cliente_id then
    raise exception 'El pago y la factura pertenecen a clientes distintos.';
  end if;
  select coalesce(sum(monto), 0) into v_aplicado from public.pago_aplicaciones where pago_id = new.pago_id;
  if v_aplicado > v_pago.monto then
    raise exception 'El pago nº % tiene aplicado % y su monto es %.', v_pago.numero, v_aplicado, v_pago.monto;
  end if;
  if v_fact.pagado > v_fact.total then
    raise exception 'La factura % quedaría con pagos (%) mayores a su total (%).',
      coalesce(v_fact.numero::text, v_fact.numero_externo), v_fact.pagado, v_fact.total;
  end if;
  return null;
end $$;
create constraint trigger pago_aplicaciones_validar after insert or update on public.pago_aplicaciones
  deferrable initially deferred
  for each row execute function public.tg_aplicacion_validar();

-- ---------------------------------------------------------------------
-- Empaques / cajas con clientes
-- ---------------------------------------------------------------------
create table public.empaques_clientes (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references public.clientes(id),
  fecha       date not null default public.hoy(),
  retiradas   integer not null default 0 check (retiradas >= 0),
  devueltas   integer not null default 0 check (devueltas >= 0),
  factura_id  bigint references public.facturas(id) on delete set null,
  nota        text,
  created_by  uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint empaques_algo check (retiradas + devueltas > 0)
);
create index empaques_clientes_cliente_idx on public.empaques_clientes (cliente_id, fecha);
create trigger empaques_clientes_auditar after insert or update or delete on public.empaques_clientes
  for each row execute function public.tg_auditar();
