-- =====================================================================
-- Tierra Santa · INSTALACIÓN COMPLETA DE LA BASE DE DATOS
-- Pegar TODO en Supabase → SQL Editor → New query → Run (una sola vez,
-- en un proyecto nuevo). Generado con scripts/generar-instalar.sh;
-- no editar a mano: editar supabase/migrations/.
-- =====================================================================

-- >>> 20261014000100_base.sql
-- =====================================================================
-- Tierra Santa · 0001 · Base: extensiones, utilidades, perfiles, roles,
-- auditoría, configuración de la empresa y contadores.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('admin', 'facturacion', 'operador', 'solo_lectura');
create type public.estado_usuario as enum ('ACTIVO', 'BLOQUEADO', 'INACTIVO');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- unaccent inmutable (necesario para columnas generadas e índices)
create or replace function public.f_unaccent(t text)
returns text language sql immutable parallel safe strict
set search_path = public, extensions
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

-- Normaliza texto para búsquedas: minúsculas, sin acentos, espacios simples
create or replace function public.normalizar(t text)
returns text language sql immutable parallel safe
as $$ select regexp_replace(lower(public.f_unaccent(coalesce(t, ''))), '\s+', ' ', 'g') $$;

-- Fecha de "hoy" en la zona horaria del negocio
create or replace function public.hoy()
returns date language sql stable
as $$ select (now() at time zone 'America/Caracas')::date $$;

-- Mantiene updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Perfiles de usuario (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,                 -- con el que inicia sesión (copia de auth.users)
  nombre             text not null default '',
  rol                public.rol_usuario not null default 'solo_lectura',
  estado             public.estado_usuario not null default 'ACTIVO',
  ultimo_acceso      timestamptz,
  debe_cambiar_clave boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index profiles_email_uk on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Crea el perfil automáticamente al crear un usuario en auth.
-- El PRIMER usuario que exista queda como admin: basta crearlo en
-- Supabase → Authentication → Add user. Cualquier otro queda INACTIVO y sin
-- acceso hasta que el panel de Usuarios (servidor con clave de servicio) le
-- asigna rol y lo activa. Nunca se confía en user_metadata para el rol.
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_primero boolean := not exists (select 1 from public.profiles where rol = 'admin');
begin
  insert into public.profiles (id, email, nombre, rol, estado)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(v_meta->>'nombre', ''), split_part(new.email, '@', 1)),
    case when v_primero then 'admin'::public.rol_usuario else 'solo_lectura' end,
    case when v_primero then 'ACTIVO'::public.estado_usuario else 'INACTIVO' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_nuevo_usuario();

-- Mantiene el correo del perfil igual al de Auth
create or replace function public.tg_usuario_correo()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function public.tg_usuario_correo();

-- ---------------------------------------------------------------------
-- Helpers de autorización (usados en RLS y funciones)
-- ---------------------------------------------------------------------

-- Rol del usuario actual si está ACTIVO; null en otro caso
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer
set search_path = public
as $$
  select p.rol from public.profiles p
  where p.id = auth.uid()
    and p.estado = 'ACTIVO'
$$;

create or replace function public.es_usuario_activo()
returns boolean language sql stable
as $$ select public.rol_actual() is not null $$;

create or replace function public.tiene_rol(variadic roles public.rol_usuario[])
returns boolean language sql stable
as $$ select coalesce(public.rol_actual() = any(roles), false) $$;

create or replace function public.es_admin()
returns boolean language sql stable
as $$ select public.tiene_rol('admin') $$;

-- Lanza error si el usuario no tiene alguno de los roles
create or replace function public.exigir_rol(variadic roles public.rol_usuario[])
returns void language plpgsql stable
as $$
begin
  if not public.tiene_rol(variadic roles) then
    raise exception 'No tienes permiso para realizar esta operación.' using errcode = '42501';
  end if;
end $$;

-- Evita que un no-admin cambie su propio rol/estado/correo
create or replace function public.tg_profiles_proteger()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    if new.rol is distinct from old.rol
       or new.estado is distinct from old.estado
       or new.email is distinct from old.email then
      raise exception 'Solo un administrador puede cambiar correo, rol o estado.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_proteger before update on public.profiles
  for each row execute function public.tg_profiles_proteger();

-- Registrar último acceso del usuario actual
create or replace function public.registrar_acceso()
returns void language sql security definer
set search_path = public
as $$ update public.profiles set ultimo_acceso = now() where id = auth.uid() $$;

-- ---------------------------------------------------------------------
-- Bitácora de auditoría
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  ocurrido_el timestamptz not null default now(),
  usuario_id  uuid references public.profiles(id) on delete set null,
  usuario     text,
  accion      text not null,           -- CREAR, EDITAR, BORRAR, ANULAR, EMITIR, LOGIN...
  tabla       text not null,
  registro_id text,
  antes       jsonb,
  despues     jsonb,
  nota        text
);
create index audit_log_fecha_idx on public.audit_log (ocurrido_el desc);
create index audit_log_tabla_idx on public.audit_log (tabla, registro_id);
create index audit_log_usuario_idx on public.audit_log (usuario_id, ocurrido_el desc);

-- Registro manual de una acción de negocio (ANULAR, EMITIR, etc.)
create or replace function public.auditar(
  p_accion text, p_tabla text, p_registro_id text,
  p_antes jsonb default null, p_despues jsonb default null, p_nota text default null)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.audit_log (usuario_id, usuario, accion, tabla, registro_id, antes, despues, nota)
  values (auth.uid(),
          coalesce((select email from public.profiles where id = auth.uid()), 'sistema'),
          p_accion, p_tabla, p_registro_id, p_antes, p_despues, p_nota);
end $$;

-- Trigger genérico: guarda antes/después de cada fila modificada.
-- Solo guarda las columnas que cambiaron en EDITAR para no inflar la tabla.
create or replace function public.tg_auditar()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_old jsonb; v_new jsonb; v_id text; k text;
  v_antes jsonb := '{}'::jsonb; v_despues jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_id := v_new->>'id';
    perform public.auditar('CREAR', tg_table_name, v_id, null, v_new);
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := v_new->>'id';
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'search') and (v_old->k) is distinct from (v_new->k) then
        v_antes := v_antes || jsonb_build_object(k, v_old->k);
        v_despues := v_despues || jsonb_build_object(k, v_new->k);
      end if;
    end loop;
    if v_despues <> '{}'::jsonb then
      perform public.auditar('EDITAR', tg_table_name, v_id, v_antes, v_despues);
    end if;
    return new;
  else
    v_old := to_jsonb(old); v_id := v_old->>'id';
    perform public.auditar('BORRAR', tg_table_name, v_id, v_old, null);
    return old;
  end if;
end $$;

create trigger profiles_auditar after insert or update or delete on public.profiles
  for each row execute function public.tg_auditar();

-- ---------------------------------------------------------------------
-- Configuración de la empresa (una sola fila, id = 1)
-- ---------------------------------------------------------------------
create table public.empresa (
  id                      smallint primary key default 1 check (id = 1),
  razon_social            text not null default 'Procesadora de Alimentos Tierra Santa',
  rif                     text not null default '',
  direccion               text not null default '',
  telefonos               text not null default '',
  correo                  text not null default '',
  logo_path               text,                         -- ruta en bucket "empresa"
  pie_factura             text not null default 'Gracias por su compra.',
  texto_legal             text not null default '',
  titulo_documento        text not null default 'Factura',  -- Factura / Nota de entrega / Pedido
  iva_pct                 numeric(5,2) not null default 16 check (iva_pct >= 0 and iva_pct <= 100),
  moneda_defecto          text not null default 'USD',
  factura_prefijo         text not null default '',
  factura_numero_inicial  bigint not null default 1 check (factura_numero_inicial > 0),
  -- Comportamientos configurables
  stock_insuficiente      text not null default 'advertir' check (stock_insuficiente in ('advertir', 'bloquear')),
  cambio_moneda_con_pagos text not null default 'convertir' check (cambio_moneda_con_pagos in ('convertir', 'bloquear')),
  roles_editan_factura    public.rol_usuario[] not null default array['admin', 'facturacion']::public.rol_usuario[],
  entregas_suman_inventario boolean not null default false,
  entregas_ubicacion_id   bigint,                        -- FK agregada en 0002
  lotes_activos           boolean not null default false,
  nomina_periodicidad     text not null default 'semanal' check (nomina_periodicidad in ('semanal', 'quincenal', 'mensual')),
  nomina_inicio_semana    smallint not null default 1 check (nomina_inicio_semana between 0 and 6), -- 1 = lunes
  updated_at              timestamptz not null default now()
);
insert into public.empresa (id) values (1);
create trigger empresa_updated_at before update on public.empresa
  for each row execute function public.tg_set_updated_at();
create trigger empresa_auditar after update on public.empresa
  for each row execute function public.tg_auditar();

-- ---------------------------------------------------------------------
-- Contadores sin huecos (se bloquea la fila dentro de la transacción)
-- ---------------------------------------------------------------------
create table public.contadores (
  clave text primary key,
  valor bigint not null default 0
);
insert into public.contadores (clave, valor) values
  ('factura', 0), ('recibo_cliente', 0), ('recibo_proveedor', 0), ('cliente', 0);

create or replace function public.siguiente_numero(p_clave text)
returns bigint language plpgsql
as $$
declare v bigint;
begin
  if p_clave = 'factura' then
    raise exception 'El número de factura solo lo asigna la emisión.';
  end if;
  update public.contadores set valor = valor + 1 where clave = p_clave returning valor into v;
  if v is null then
    raise exception 'Contador % no existe', p_clave;
  end if;
  return v;
end $$;

-- >>> 20261014000200_catalogos.sql
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

-- >>> 20261014000300_clientes_facturas.sql
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

-- >>> 20261014000400_proveedores.sql
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

-- >>> 20261014000500_inventario.sql
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

-- >>> 20261014000600_nomina.sql
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

-- >>> 20261014000700_funciones_facturacion.sql
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

-- >>> 20261014000800_vistas_saldos.sql
-- =====================================================================
-- Tierra Santa · 0008 · Vistas y funciones de saldos (agregados en BD).
-- Las vistas usan security_invoker para respetar RLS del usuario.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes: saldo por cliente y moneda
-- saldo = Σ saldos pendientes de facturas − saldo a favor
-- ---------------------------------------------------------------------
create or replace view public.v_saldos_clientes_moneda with (security_invoker = true) as
with f as (
  select cliente_id, moneda,
         sum(total) filter (where estado = 'emitida') facturado,
         sum(pagado) filter (where estado = 'emitida') pagado_facturas,
         sum(saldo) pendiente,
         count(*) filter (where estado = 'emitida' and saldo > 0) facturas_pendientes,
         min(fecha) filter (where estado = 'emitida' and saldo > 0) pendiente_desde
    from public.facturas where estado = 'emitida'
   group by cliente_id, moneda),
p as (
  select pc.cliente_id, pc.moneda, sum(pc.monto) recibido,
         sum(pc.monto) - coalesce(sum(ap.aplicado), 0) a_favor
    from public.pagos_clientes pc
    left join (select pago_id, sum(monto) aplicado from public.pago_aplicaciones group by pago_id) ap
      on ap.pago_id = pc.id
   group by pc.cliente_id, pc.moneda)
select coalesce(f.cliente_id, p.cliente_id) cliente_id,
       coalesce(f.moneda, p.moneda) moneda,
       coalesce(f.facturado, 0) facturado,
       coalesce(p.recibido, 0) recibido,
       coalesce(f.pendiente, 0) pendiente_facturas,
       coalesce(p.a_favor, 0) saldo_a_favor,
       coalesce(f.pendiente, 0) - coalesce(p.a_favor, 0) saldo,
       coalesce(f.facturas_pendientes, 0) facturas_pendientes,
       f.pendiente_desde
  from f full join p on p.cliente_id = f.cliente_id and p.moneda = f.moneda;

-- Resumen por cliente (una fila): saldos USD/COP/VES, cajas, moneda y estado
create or replace view public.v_resumen_clientes with (security_invoker = true) as
with s as (
  select cliente_id,
         sum(saldo) filter (where moneda = 'USD') saldo_usd,
         sum(saldo) filter (where moneda = 'COP') saldo_cop,
         sum(saldo) filter (where moneda = 'VES') saldo_ves,
         sum(facturas_pendientes) facturas_pendientes,
         min(pendiente_desde) pendiente_desde
    from public.v_saldos_clientes_moneda group by cliente_id),
e as (
  select cliente_id, sum(retiradas) retiradas, sum(devueltas) devueltas
    from public.empaques_clientes group by cliente_id)
select c.id, c.numero, c.nombre, c.documento, c.telefono, c.activo, c.search,
       upper(left(public.f_unaccent(trim(c.nombre)), 1)) letra,
       coalesce(s.saldo_usd, 0) saldo_usd,
       coalesce(s.saldo_cop, 0) saldo_cop,
       coalesce(s.saldo_ves, 0) saldo_ves,
       coalesce(e.retiradas, 0) cajas_retiradas,
       coalesce(e.devueltas, 0) cajas_devueltas,
       coalesce(e.retiradas, 0) - coalesce(e.devueltas, 0) cajas_pendientes,
       coalesce(s.facturas_pendientes, 0) facturas_pendientes,
       s.pendiente_desde,
       nullif(concat_ws('/',
         case when coalesce(s.saldo_usd, 0) > 0 then 'USD' end,
         case when coalesce(s.saldo_cop, 0) > 0 then 'COP' end,
         case when coalesce(s.saldo_ves, 0) > 0 then 'VES' end), '') moneda,
       case when coalesce(s.saldo_usd, 0) > 0 or coalesce(s.saldo_cop, 0) > 0 or coalesce(s.saldo_ves, 0) > 0
            then 'CRÍTICO' else 'AL DÍA' end estado
  from public.clientes c
  left join s on s.cliente_id = c.id
  left join e on e.cliente_id = c.id;

-- KPIs del panel de clientes
create or replace function public.kpis_clientes()
returns jsonb language sql stable security invoker
as $$
  select jsonb_build_object(
    'clientes', count(*) filter (where activo),
    'saldo_usd', coalesce(sum(saldo_usd) filter (where saldo_usd > 0), 0),
    'saldo_cop', coalesce(sum(saldo_cop) filter (where saldo_cop > 0), 0),
    'saldo_ves', coalesce(sum(saldo_ves) filter (where saldo_ves > 0), 0),
    'cajas_pendientes', coalesce(sum(cajas_pendientes), 0),
    'al_dia', count(*) filter (where activo and estado = 'AL DÍA'),
    'criticos', count(*) filter (where estado = 'CRÍTICO'))
  from public.v_resumen_clientes
$$;

-- Antigüedad de saldos por cliente y moneda a una fecha de corte
create or replace function public.antiguedad_cxc(p_corte date default public.hoy(), p_moneda text default null)
returns table (cliente_id bigint, numero integer, nombre text, moneda text,
               d0_15 numeric, d16_30 numeric, d31_60 numeric, d60_mas numeric, total numeric)
language sql stable security invoker
as $$
  select c.id, c.numero, c.nombre, f.moneda,
         sum(f.saldo) filter (where p_corte - f.fecha <= 15),
         sum(f.saldo) filter (where p_corte - f.fecha between 16 and 30),
         sum(f.saldo) filter (where p_corte - f.fecha between 31 and 60),
         sum(f.saldo) filter (where p_corte - f.fecha > 60),
         sum(f.saldo)
    from public.facturas f join public.clientes c on c.id = f.cliente_id
   where f.estado = 'emitida' and f.saldo > 0 and f.fecha <= p_corte
     and (p_moneda is null or f.moneda = p_moneda)
   group by c.id, c.numero, c.nombre, f.moneda
   order by sum(f.saldo) desc
$$;

-- ---------------------------------------------------------------------
-- Proveedores: saldo a favor del proveedor por moneda = Σ entregas − Σ abonos
-- ---------------------------------------------------------------------
create or replace view public.v_saldos_proveedores_moneda with (security_invoker = true) as
with e as (
  select proveedor_id, moneda, sum(total) entregas, sum(kg_total) kg, sum(merma) merma,
         sum(peso_neto) peso_neto, count(*) n_entregas, max(fecha) ultima_entrega
    from public.entregas_proveedor group by proveedor_id, moneda),
a as (
  select proveedor_id, moneda, sum(monto) abonos, count(*) n_abonos, max(fecha) ultimo_abono
    from public.abonos_proveedor group by proveedor_id, moneda)
select coalesce(e.proveedor_id, a.proveedor_id) proveedor_id,
       coalesce(e.moneda, a.moneda) moneda,
       coalesce(e.entregas, 0) total_entregas,
       coalesce(a.abonos, 0) total_abonos,
       coalesce(e.entregas, 0) - coalesce(a.abonos, 0) saldo,
       coalesce(e.kg, 0) kg_total, coalesce(e.merma, 0) merma, coalesce(e.peso_neto, 0) peso_neto,
       coalesce(e.n_entregas, 0) n_entregas, coalesce(a.n_abonos, 0) n_abonos,
       e.ultima_entrega, a.ultimo_abono
  from e full join a on a.proveedor_id = e.proveedor_id and a.moneda = e.moneda;

create or replace view public.v_resumen_proveedores with (security_invoker = true) as
with s as (
  select proveedor_id,
         sum(saldo) filter (where moneda = 'COP') saldo_cop,
         sum(saldo) filter (where moneda = 'USD') saldo_usd,
         sum(saldo) filter (where moneda = 'VES') saldo_ves,
         max(ultima_entrega) ultima_entrega
    from public.v_saldos_proveedores_moneda group by proveedor_id),
c as (
  select proveedor_id, sum(entregadas) entregadas, sum(devueltas) devueltas
    from public.cestas_proveedor group by proveedor_id)
select p.id, p.nombre, p.documento, p.telefono, p.ubicacion, p.moneda_habitual, p.activo, p.search,
       upper(left(public.f_unaccent(trim(p.nombre)), 1)) letra,
       coalesce(s.saldo_cop, 0) saldo_cop,
       coalesce(s.saldo_usd, 0) saldo_usd,
       coalesce(s.saldo_ves, 0) saldo_ves,
       coalesce(c.entregadas, 0) cestas_entregadas,
       coalesce(c.devueltas, 0) cestas_devueltas,
       coalesce(c.entregadas, 0) - coalesce(c.devueltas, 0) cestas_pendientes,
       s.ultima_entrega,
       (coalesce(s.saldo_cop, 0) > 0 or coalesce(s.saldo_usd, 0) > 0 or coalesce(s.saldo_ves, 0) > 0) con_saldo
  from public.proveedores p
  left join s on s.proveedor_id = p.id
  left join c on c.proveedor_id = p.id;

create or replace function public.kpis_proveedores()
returns jsonb language sql stable security invoker
as $$
  select jsonb_build_object(
    'proveedores', count(*) filter (where activo),
    'saldo_cop', coalesce(sum(saldo_cop), 0),
    'saldo_usd', coalesce(sum(saldo_usd), 0),
    'saldo_ves', coalesce(sum(saldo_ves), 0),
    'cestas_pendientes', coalesce(sum(cestas_pendientes), 0),
    'con_saldo', count(*) filter (where con_saldo))
  from public.v_resumen_proveedores
$$;

-- ---------------------------------------------------------------------
-- Inventario: stock por producto/ubicación con indicador
-- ---------------------------------------------------------------------
create or replace view public.v_stock with (security_invoker = true) as
select p.id producto_id, p.codigo, p.nombre, p.emoji, p.unidad, p.tipo, p.stock_minimo,
       u.id ubicacion_id, u.nombre ubicacion, e.forma,
       sum(e.cantidad) cantidad,
       case when sum(e.cantidad) <= 0 then 'agotado'
            when sum(e.cantidad) < p.stock_minimo then 'bajo'
            else 'normal' end indicador
  from public.existencias e
  join public.productos p on p.id = e.producto_id
  join public.ubicaciones u on u.id = e.ubicacion_id
 group by p.id, u.id, e.forma;

-- Stock total por producto (todas las ubicaciones), para alertas
create or replace view public.v_stock_total with (security_invoker = true) as
select p.id producto_id, p.codigo, p.nombre, p.emoji, p.unidad, p.tipo, p.stock_minimo, p.activo,
       coalesce(sum(e.cantidad) filter (where e.forma = 'PT'), 0) stock_pt,
       coalesce(sum(e.cantidad) filter (where e.forma = 'MP'), 0) stock_mp,
       case when coalesce(sum(e.cantidad) filter (where e.forma = public.forma_venta(p.id)), 0) <= 0 then 'agotado'
            when coalesce(sum(e.cantidad) filter (where e.forma = public.forma_venta(p.id)), 0) < p.stock_minimo then 'bajo'
            else 'normal' end indicador
  from public.productos p
  left join public.existencias e on e.producto_id = p.id
 group by p.id;

-- Kardex: movimientos con saldo corrido por producto (y opcionalmente ubicación/forma)
create or replace function public.kardex(
  p_producto_id bigint, p_desde date default null, p_hasta date default null,
  p_ubicacion_id bigint default null, p_forma public.forma_inventario default null)
returns table (id bigint, fecha timestamptz, tipo public.tipo_movimiento, ubicacion text, forma public.forma_inventario,
               entrada numeric, salida numeric, saldo numeric, referencia text, nota text, usuario text)
language sql stable security invoker
as $$
  with base as (
    select m.*, sum(m.cantidad) over (order by m.fecha, m.id) as corrido
      from public.movimientos_inventario m
     where m.producto_id = p_producto_id
       and (p_ubicacion_id is null or m.ubicacion_id = p_ubicacion_id)
       and (p_forma is null or m.forma = p_forma)
       and (p_hasta is null or (m.fecha at time zone 'America/Caracas')::date <= p_hasta))
  select b.id, b.fecha, b.tipo, u.nombre, b.forma,
         case when b.cantidad > 0 then b.cantidad end,
         case when b.cantidad < 0 then -b.cantidad end,
         b.corrido,
         case when b.factura_id is not null then 'Factura ' || coalesce(f.numero::text, f.numero_externo)
              when b.entrega_id is not null then 'Entrega #' || b.entrega_id
              when b.produccion_id is not null then 'Producción #' || b.produccion_id
              when b.traslado_id is not null then 'Traslado'
              else null end,
         b.nota, pr.email
    from base b
    join public.ubicaciones u on u.id = b.ubicacion_id
    left join public.facturas f on f.id = b.factura_id
    left join public.profiles pr on pr.id = b.created_by
   where p_desde is null or (b.fecha at time zone 'America/Caracas')::date >= p_desde
   order by b.fecha, b.id
$$;

-- ---------------------------------------------------------------------
-- Nómina: saldo neto por empleado = ganado − abonos
-- ---------------------------------------------------------------------
create or replace view public.v_resumen_empleados with (security_invoker = true) as
with j as (
  select empleado_id, count(*) filter (where estado <> 'no') jornadas, sum(ganado) ganado,
         max(fecha) ultima_jornada
    from public.jornadas group by empleado_id),
a as (
  select empleado_id, sum(monto) abonos, count(*) n_abonos
    from public.abonos_empleados group by empleado_id)
select e.id, e.codigo, e.nombre, e.cedula, e.tipo, e.tarifa_dia, e.cargo, e.activo, e.search,
       upper(left(public.f_unaccent(trim(e.nombre)), 1)) letra,
       coalesce(j.jornadas, 0) jornadas, coalesce(j.ganado, 0) ganado,
       coalesce(a.abonos, 0) abonos, coalesce(a.n_abonos, 0) n_abonos,
       coalesce(j.ganado, 0) - coalesce(a.abonos, 0) saldo_neto,
       j.ultima_jornada
  from public.empleados e
  left join j on j.empleado_id = e.id
  left join a on a.empleado_id = e.id;

-- >>> 20261014000900_seguridad_rls.sql
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

-- >>> 20261014001000_storage.sql
-- =====================================================================
-- Tierra Santa · 0010 · Storage: buckets y políticas.
--   empresa   (público)  → logo de la empresa
--   entregas  (privado)  → fotos de entregas de proveedores
--   facturas  (privado)  → PDFs/soportes de facturas
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('empresa', 'empresa', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('entregas', 'entregas', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/heic']),
  ('facturas', 'facturas', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "empresa_lectura" on storage.objects for select
  using (bucket_id = 'empresa');
create policy "empresa_escritura_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'empresa' and public.es_admin());
create policy "empresa_actualizar_admin" on storage.objects for update to authenticated
  using (bucket_id = 'empresa' and public.es_admin());
create policy "empresa_borrar_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'empresa' and public.es_admin());

create policy "entregas_lectura" on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and public.es_usuario_activo());
create policy "entregas_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and public.tiene_rol('admin', 'facturacion', 'operador'));
create policy "entregas_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'entregas' and public.tiene_rol('admin', 'facturacion'));

create policy "facturas_lectura" on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and public.es_usuario_activo());
create policy "facturas_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas' and public.tiene_rol('admin', 'facturacion'));
create policy "facturas_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'facturas' and public.tiene_rol('admin', 'facturacion'));

-- >>> 20261014001100_datos_iniciales.sql
-- =====================================================================
-- Tierra Santa · 0011 · Datos iniciales (todos editables desde Configuración)
-- =====================================================================
insert into public.unidades (codigo, nombre, plural) values
  ('kg', 'kilogramo', 'kilogramos'),
  ('und', 'unidad', 'unidades'),
  ('cesta', 'cesta', 'cestas'),
  ('caja', 'caja', 'cajas'),
  ('bolsa', 'bolsa', 'bolsas'),
  ('lt', 'litro', 'litros')
on conflict do nothing;

insert into public.ubicaciones (nombre, descripcion, es_cuarto_frio, predeterminada) values
  ('Planta principal', 'Sede de procesamiento', false, true),
  ('Cuarto frío planta', 'Congelación de pulpa', true, false),
  ('Galpón', null, false, false),
  ('Otra sede', null, false, false);


insert into public.productos (codigo, nombre, emoji, unidad, tipo, kg_por_cesta, modo_pesaje) values
  (1, 'Guanábana', '🍈', 'kg', 'ambos', 20, 'FIJO'),
  (2, 'Parchita', '🟡', 'kg', 'ambos', 18, 'FIJO'),
  (3, 'Durazno', '🍑', 'kg', 'ambos', 20, 'FIJO'),
  (4, 'Fresa', '🍓', 'kg', 'ambos', 10, 'FIJO'),
  (5, 'Mora', '🫐', 'kg', 'ambos', 10, 'FIJO'),
  (6, 'Piña', '🍍', 'kg', 'ambos', null, 'VARIABLE'),
  (7, 'Mango', '🥭', 'kg', 'ambos', 20, 'FIJO'),
  (8, 'Tomate de árbol', '🍅', 'kg', 'ambos', 20, 'FIJO'),
  (9, 'Guayaba', '🍐', 'kg', 'ambos', 20, 'FIJO')
on conflict do nothing;

insert into public.metodos_pago (nombre, orden) values
  ('Efectivo', 1), ('Transferencia', 2), ('Zelle', 3), ('Bancolombia', 4), ('Pago móvil', 5), ('Nequi', 6)
on conflict do nothing;

insert into public.tareas_nomina (emoji, nombre, valor, unidad, orden) values
  ('🍓', 'Espicada de Fresa', 5000, 'cesta', 1),
  ('🌿', 'Cortada de Parchita', 3600, 'cesta', 2),
  ('🍍', 'Despulpar Piña', 2200, 'cesta', 3),
  ('🍑', 'Cortada de Durazno', 10000, 'cesta', 4),
  ('🍅', 'Despulpar Tomate de Árbol', 2100, 'cesta', 5),
  ('🥭', 'Despulpar Mango', 2300, 'cesta', 6),
  ('🍐', 'Despulpar Guayaba', 1700, 'cesta', 7)
on conflict do nothing;

-- >>> 20261015000100_proveedores_fase3.sql
-- =====================================================================
-- Tierra Santa · Fase 3 · Proveedores
-- 1) Las entregas de proveedores YA NO suman al inventario: el inventario
--    solo crece con las entradas de producción que registra la planta
--    (la fruta se procesa antes de ser producto final).
-- 2) Búsqueda de proveedores con filtros y estado de cuenta por moneda.
-- =====================================================================

-- 1) Quitar la entrada automática de entregas al inventario
drop trigger if exists entregas_inventario_iu on public.entregas_proveedor;
drop trigger if exists entregas_inventario_d on public.entregas_proveedor;
drop function if exists public.tg_entrega_inventario();
alter table public.empresa drop column if exists entregas_ubicacion_id;
alter table public.empresa drop column if exists entregas_suman_inventario;

-- 2) Panel de proveedores: búsqueda y filtros del lado del servidor
--    p_moneda: solo proveedores con saldo pendiente (> 0) en esa moneda
--    p_producto / p_desde / p_hasta: proveedores con entregas de ese rubro / en ese rango
create or replace function public.buscar_proveedores(
  p_q text default null, p_moneda text default null, p_con_saldo boolean default false,
  p_producto bigint default null, p_desde date default null, p_hasta date default null,
  p_incluir_inactivos boolean default false)
returns setof public.v_resumen_proveedores
language sql stable security invoker
set search_path = public, extensions
as $$
  select r.* from public.v_resumen_proveedores r
   where (p_incluir_inactivos or r.activo)
     and (coalesce(trim(p_q), '') = '' or r.search like '%' || public.normalizar(p_q) || '%')
     and (p_moneda is null
          or (p_moneda = 'COP' and r.saldo_cop > 0)
          or (p_moneda = 'USD' and r.saldo_usd > 0)
          or (p_moneda = 'VES' and r.saldo_ves > 0))
     and (not p_con_saldo or r.con_saldo)
     and (p_producto is null and p_desde is null and p_hasta is null
          or exists (select 1 from public.entregas_proveedor e
                      where e.proveedor_id = r.id
                        and (p_producto is null or e.producto_id = p_producto)
                        and (p_desde is null or e.fecha >= p_desde)
                        and (p_hasta is null or e.fecha <= p_hasta)))
   order by public.normalizar(r.nombre)
$$;

-- 3) Estado de cuenta de un proveedor en una moneda
--    Primera fila: saldo anterior a p_desde. Luego entregas (cargo) y abonos (abono)
--    en orden cronológico con saldo corrido. Saldo > 0 = se le debe al proveedor.
create or replace function public.estado_cuenta_proveedor(
  p_proveedor_id bigint, p_moneda text, p_desde date default null, p_hasta date default null)
returns table (fecha date, tipo text, ref_id bigint, detalle text, cestas numeric, kg numeric, merma numeric,
               cargo numeric, abono numeric, saldo numeric)
language sql stable security invoker
set search_path = public
as $$
  with mov as (
    select e.fecha, 'entrega'::text tipo, e.id ref_id,
           p.nombre || case when e.modo_pesaje = 'FIJO' then ' · ' || replace(trim_scale(e.cestas)::text, '.', ',') || ' cestas' else '' end
             || case when e.nota is not null then ' · ' || e.nota else '' end detalle,
           e.cestas, e.kg_total kg, e.merma, e.total cargo, 0::numeric abono, 1 orden
      from public.entregas_proveedor e join public.productos p on p.id = e.producto_id
     where e.proveedor_id = p_proveedor_id and e.moneda = p_moneda
    union all
    select a.fecha, 'abono', a.id,
           'Abono' || coalesce(' · ' || m.nombre, '') || coalesce(' · Ref. ' || a.referencia, '')
             || coalesce(' · ' || a.pagado_por, '') || coalesce(' · ' || a.nota, ''),
           null, null, null, 0, a.monto, 2
      from public.abonos_proveedor a left join public.metodos_pago m on m.id = a.metodo_id
     where a.proveedor_id = p_proveedor_id and a.moneda = p_moneda),
  anterior as (
    select coalesce(sum(cargo - abono), 0) s from mov where p_desde is not null and mov.fecha < p_desde),
  rango as (
    select * from mov
     where (p_desde is null or mov.fecha >= p_desde) and (p_hasta is null or mov.fecha <= p_hasta))
  select p_desde, 'saldo_anterior', null::bigint, 'Saldo anterior', null::numeric, null::numeric, null::numeric,
         null::numeric, null::numeric, (select s from anterior)
   where p_desde is not null
  union all
  (select r.fecha, r.tipo, r.ref_id, r.detalle, r.cestas, r.kg, r.merma, r.cargo, r.abono,
          (select s from anterior) + sum(r.cargo - r.abono) over (order by r.fecha, r.orden, r.ref_id)
     from rango r
    order by r.fecha, r.orden, r.ref_id)
$$;

grant execute on function public.buscar_proveedores(text, text, boolean, bigint, date, date, boolean) to authenticated;
grant execute on function public.estado_cuenta_proveedor(bigint, text, date, date) to authenticated;
