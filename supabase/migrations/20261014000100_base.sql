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
  usuario            text not null,
  nombre             text not null default '',
  email              text,
  rol                public.rol_usuario not null default 'solo_lectura',
  estado             public.estado_usuario not null default 'ACTIVO',
  vence_el           date,
  ultimo_acceso      timestamptz,
  debe_cambiar_clave boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_usuario_formato check (usuario ~ '^[a-z0-9._-]{3,40}$')
);
create unique index profiles_usuario_uk on public.profiles (lower(usuario));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Crea el perfil automáticamente al crear un usuario en auth
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, usuario, nombre, email, rol, estado, vence_el, debe_cambiar_clave)
  values (
    new.id,
    lower(coalesce(nullif(v_meta->>'usuario', ''), split_part(new.email, '@', 1))),
    coalesce(v_meta->>'nombre', ''),
    case when new.email like '%@usuarios.tierrasanta.local' then null else new.email end,
    coalesce((v_meta->>'rol')::public.rol_usuario, 'solo_lectura'),
    'ACTIVO',
    nullif(v_meta->>'vence_el', '')::date,
    coalesce((v_meta->>'debe_cambiar_clave')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_nuevo_usuario();

-- ---------------------------------------------------------------------
-- Helpers de autorización (usados en RLS y funciones)
-- ---------------------------------------------------------------------

-- Rol del usuario actual si está ACTIVO y no vencido; null en otro caso
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer
set search_path = public
as $$
  select p.rol from public.profiles p
  where p.id = auth.uid()
    and p.estado = 'ACTIVO'
    and (p.vence_el is null or p.vence_el >= public.hoy())
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

-- Evita que un no-admin cambie su propio rol/estado/vencimiento
create or replace function public.tg_profiles_proteger()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    if new.rol is distinct from old.rol
       or new.estado is distinct from old.estado
       or new.vence_el is distinct from old.vence_el
       or new.usuario is distinct from old.usuario then
      raise exception 'Solo un administrador puede cambiar usuario, rol, estado o vencimiento.' using errcode = '42501';
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
          (select usuario from public.profiles where id = auth.uid()),
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
