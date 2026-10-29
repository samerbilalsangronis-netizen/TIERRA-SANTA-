-- =====================================================================
-- Tierra Santa · Gastos (lo que se compra y se paga en el momento)
--
-- Guantes, tapabocas, café, benzoato, cuchillos, gasolina… Cada gasto
-- tiene un concepto (lista editable) agrupado en una categoría. Lo que un
-- proveedor trae a crédito sigue en Proveedores (insumos).
-- No lleva inventario de insumos: solo lo gastado.
-- =====================================================================

create table public.categorias_gasto (
  id      bigint generated always as identity primary key,
  nombre  text not null check (length(trim(nombre)) > 0),
  orden   integer not null default 0,
  activa  boolean not null default true
);
create unique index categorias_gasto_nombre_uk on public.categorias_gasto (public.normalizar(nombre));

create table public.conceptos_gasto (
  id            bigint generated always as identity primary key,
  categoria_id  bigint not null references public.categorias_gasto(id),
  nombre        text not null check (length(trim(nombre)) > 0),
  unidad        text not null default 'und' references public.unidades(codigo),
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index conceptos_gasto_nombre_uk on public.conceptos_gasto (public.normalizar(nombre));
create trigger conceptos_gasto_auditar after insert or update or delete on public.conceptos_gasto
  for each row execute function public.tg_auditar();

create table public.gastos (
  id           bigint generated always as identity primary key,
  fecha        date not null default public.hoy(),
  concepto_id  bigint not null references public.conceptos_gasto(id),
  cantidad     numeric(12,3) check (cantidad is null or cantidad > 0),
  unidad       text references public.unidades(codigo),
  monto        numeric(14,2) not null check (monto > 0),
  moneda       text not null references public.monedas(codigo),
  metodo_id    bigint references public.metodos_pago(id),
  lugar        text,                 -- dónde se compró
  pagado_por   text,
  nota         text,
  foto_path    text,                 -- foto de la factura/recibo (bucket "gastos")
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_concepto_idx on public.gastos (concepto_id, fecha);
create trigger gastos_updated_at before update on public.gastos
  for each row execute function public.tg_set_updated_at();
create trigger gastos_auditar after insert or update or delete on public.gastos
  for each row execute function public.tg_auditar();

-- Seguridad: todos los usuarios activos ven; registran admin, facturación y
-- operador; corrigen y borran admin y facturación; la lista de conceptos la
-- amplían quienes registran (para agregar uno nuevo al momento).
alter table public.categorias_gasto enable row level security;
alter table public.conceptos_gasto enable row level security;
alter table public.gastos enable row level security;
create policy categorias_gasto_select on public.categorias_gasto for select to authenticated using (public.es_usuario_activo());
create policy categorias_gasto_admin on public.categorias_gasto for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy conceptos_gasto_select on public.conceptos_gasto for select to authenticated using (public.es_usuario_activo());
create policy conceptos_gasto_insert on public.conceptos_gasto for insert to authenticated
  with check (public.tiene_rol('admin', 'facturacion', 'operador'));
create policy conceptos_gasto_update on public.conceptos_gasto for update to authenticated
  using (public.tiene_rol('admin', 'facturacion')) with check (public.tiene_rol('admin', 'facturacion'));
create policy conceptos_gasto_delete on public.conceptos_gasto for delete to authenticated using (public.es_admin());
create policy gastos_select on public.gastos for select to authenticated using (public.es_usuario_activo());
create policy gastos_insert on public.gastos for insert to authenticated
  with check (public.tiene_rol('admin', 'facturacion', 'operador'));
create policy gastos_update on public.gastos for update to authenticated
  using (public.tiene_rol('admin', 'facturacion')) with check (public.tiene_rol('admin', 'facturacion'));
create policy gastos_delete on public.gastos for delete to authenticated
  using (public.tiene_rol('admin', 'facturacion'));
grant select, insert, update, delete on public.categorias_gasto, public.conceptos_gasto, public.gastos to authenticated;

-- Fotos de facturas o recibos de gastos (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('gastos', 'gastos', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
create policy "gastos_lectura" on storage.objects for select to authenticated
  using (bucket_id = 'gastos' and public.es_usuario_activo());
create policy "gastos_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'gastos' and public.tiene_rol('admin', 'facturacion', 'operador'));
create policy "gastos_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'gastos' and public.tiene_rol('admin', 'facturacion'));

-- Categorías y conceptos iniciales (se pueden cambiar en Configuración → Catálogos)
insert into public.categorias_gasto (nombre, orden) values
  ('Aditivos y conservantes', 1), ('Empaque', 2), ('Higiene y protección', 3),
  ('Utensilios', 4), ('Cafetería', 5), ('Transporte', 6), ('Otros', 99)
on conflict do nothing;

insert into public.conceptos_gasto (categoria_id, nombre, unidad)
select c.id, v.nombre, v.unidad
  from (values
    ('Aditivos y conservantes', 'Benzoato', 'kg'), ('Aditivos y conservantes', 'Dióxido', 'kg'),
    ('Aditivos y conservantes', 'Metabisulfito', 'kg'),
    ('Empaque', 'Bolsas', 'und'), ('Empaque', 'Cintas', 'und'), ('Empaque', 'Cestas', 'und'),
    ('Higiene y protección', 'Guantes', 'und'), ('Higiene y protección', 'Tapabocas', 'und'),
    ('Higiene y protección', 'Bolsas de aseo', 'und'),
    ('Utensilios', 'Cuchillos', 'und'), ('Utensilios', 'Poncheras', 'und'), ('Utensilios', 'Jarras', 'und'),
    ('Cafetería', 'Café', 'kg'), ('Cafetería', 'Azúcar', 'kg'),
    ('Transporte', 'Gasolina', 'lt')
  ) v(categoria, nombre, unidad)
  join public.categorias_gasto c on c.nombre = v.categoria
  where exists (select 1 from public.unidades u where u.codigo = v.unidad)
on conflict do nothing;

-- Resumen para el reporte y el dashboard: por categoría, concepto y moneda
create or replace function public.gastos_resumen(p_desde date, p_hasta date)
returns table (categoria_id bigint, categoria text, concepto_id bigint, concepto text, moneda text,
               veces bigint, cantidad numeric, unidad text, monto numeric)
language sql stable security invoker
set search_path = public
as $$
  select ca.id, ca.nombre, co.id, co.nombre, g.moneda, count(*),
         sum(g.cantidad), max(coalesce(g.unidad, co.unidad)), sum(g.monto)
    from public.gastos g
    join public.conceptos_gasto co on co.id = g.concepto_id
    join public.categorias_gasto ca on ca.id = co.categoria_id
   where g.fecha between p_desde and p_hasta
   group by ca.id, co.id, g.moneda
   order by min(ca.orden), ca.nombre, sum(g.monto) desc
$$;
revoke execute on function public.gastos_resumen(date, date) from public, anon;
grant execute on function public.gastos_resumen(date, date) to authenticated;
