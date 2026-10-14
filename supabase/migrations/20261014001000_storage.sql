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
