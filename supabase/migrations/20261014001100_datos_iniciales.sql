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
