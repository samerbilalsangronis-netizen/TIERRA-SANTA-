-- =====================================================================
-- Tierra Santa · Porcentaje de pulpa por rubro (gráfico de Inventario)
--
-- Cada producto que se vende sabe de qué fruta sale (fruta_id) y cuántos
-- kg de pulpa lleva cada unidad (peso_kg: 0,8 la bolsa de 800 g, 1 la de 1 kg).
-- Así se suman las bolsas de 800 g y de 1 kg de una misma fruta en kg y se
-- muestra qué porcentaje del total es cada fruta.
-- =====================================================================

alter table public.productos
  add column if not exists fruta_id bigint references public.productos(id),
  add column if not exists peso_kg numeric(10,3) check (peso_kg is null or peso_kg > 0);
comment on column public.productos.fruta_id is 'Fruta (materia prima) de la que sale este producto';
comment on column public.productos.peso_kg is 'Kg de pulpa por unidad vendida (bolsa de 800 g = 0,8)';

-- Las bolsas creadas por la migración anterior se enlazan con su fruta
update public.productos b
   set fruta_id = f.id,
       peso_kg = case when b.nombre = f.nombre || ' 800 g' then 0.8 else 1 end
  from public.productos f
 where f.tipo = 'materia_prima' and f.categoria = 'fruta' and b.tipo = 'terminado'
   and b.fruta_id is null
   and b.nombre in (f.nombre || ' 800 g', f.nombre || ' 1 kg');

-- Kg de pulpa por fruta: en inventario (sin fechas) o producidos en un rango.
-- Las bolsas se pasan a kg con peso_kg y se agrupan por su fruta de origen.
create or replace function public.pulpa_por_fruta(p_desde date default null, p_hasta date default null)
returns table (fruta_id bigint, codigo integer, nombre text, emoji text, kg numeric)
language sql stable security invoker
set search_path = public
as $$
  with cant as (
    select e.producto_id, sum(e.cantidad) cantidad
      from public.existencias e
     where p_desde is null and e.forma = 'PT'
     group by e.producto_id
    union all
    select m.producto_id, sum(m.cantidad)
      from public.movimientos_inventario m
      join public.producciones pr on pr.id = m.produccion_id
     where p_desde is not null and m.tipo = 'produccion'
       and pr.fecha between p_desde and coalesce(p_hasta, public.hoy())
     group by m.producto_id)
  select coalesce(f.id, p.id), coalesce(f.codigo, p.codigo), coalesce(f.nombre, p.nombre), coalesce(f.emoji, p.emoji),
         sum(c.cantidad * coalesce(p.peso_kg, case when p.unidad = 'kg' then 1 end))
    from cant c
    join public.productos p on p.id = c.producto_id
    left join public.productos f on f.id = p.fruta_id
   where coalesce(p.peso_kg, case when p.unidad = 'kg' then 1 end) is not null
   group by 1, 2, 3, 4
  having sum(c.cantidad * coalesce(p.peso_kg, case when p.unidad = 'kg' then 1 end)) > 0
   order by 5 desc
$$;
revoke execute on function public.pulpa_por_fruta(date, date) from public, anon;
grant execute on function public.pulpa_por_fruta(date, date) to authenticated;
