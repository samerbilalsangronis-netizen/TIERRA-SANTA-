-- =====================================================================
-- Tierra Santa · Fase 5 · Facturación
-- Listado de facturas con búsqueda y filtros en el servidor (con totales
-- del filtro), últimos precios por cliente para sugerir al facturar y
-- endurecimiento de permisos de funciones (los anónimos no ejecutan nada
-- salvo los datos públicos del inicio).
-- =====================================================================

-- 1) Facturas que cumplen un filtro (base del listado y de sus totales)
--    p_q: nº de factura (con o sin prefijo/ceros), nº externo, cliente
--         (nombre, nº, cédula/RIF) o producto (código o descripción).
--    p_estado: borrador | pendiente | abonada | pagada | anulada | por_cobrar
--              (vacío = todas menos los borradores)
create or replace function public.facturas_filtradas(
  p_q text default null, p_estado text default null, p_moneda text default null,
  p_desde date default null, p_hasta date default null, p_cliente_id bigint default null)
returns setof public.facturas
language sql stable security invoker
set search_path = public, extensions
as $$
  with q as (
    select nullif(public.normalizar(trim(coalesce(p_q, ''))), '') t,
           nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '') digitos)
  select f.* from public.facturas f, q
   where (case
            when coalesce(p_estado, '') = '' then f.estado <> 'borrador'
            when p_estado = 'por_cobrar' then f.estado = 'emitida' and f.saldo > 0
            else f.estado_pago = p_estado
          end)
     and (p_moneda is null or p_moneda = '' or f.moneda = p_moneda)
     and (p_desde is null or f.fecha >= p_desde)
     and (p_hasta is null or f.fecha <= p_hasta)
     and (p_cliente_id is null or f.cliente_id = p_cliente_id)
     and (q.t is null
          or (q.digitos is not null and f.numero::text = ltrim(q.digitos, '0'))
          or public.normalizar(coalesce(f.numero_externo, '')) like '%' || q.t || '%'
          or public.normalizar(coalesce(f.cliente_nombre, '') || ' ' || coalesce(f.cliente_documento, '')) like '%' || q.t || '%'
          or f.cliente_numero::text = q.t
          or exists (select 1 from public.factura_lineas l
                      where l.factura_id = f.id
                        and (public.normalizar(l.descripcion) like '%' || q.t || '%' or l.codigo::text = q.t)))
$$;

-- 2) Página del listado (más recientes primero)
create or replace function public.buscar_facturas(
  p_q text default null, p_estado text default null, p_moneda text default null,
  p_desde date default null, p_hasta date default null, p_cliente_id bigint default null,
  p_limite int default 50, p_desplazamiento int default 0)
returns table (id bigint, origen public.origen_factura, numero bigint, numero_externo text,
               estado public.estado_factura, estado_pago text, fecha date, moneda text,
               cliente_id bigint, cliente_numero integer, cliente_nombre text,
               total numeric, pagado numeric, saldo numeric, version integer)
language sql stable security invoker
set search_path = public, extensions
as $$
  select f.id, f.origen, f.numero, f.numero_externo, f.estado, f.estado_pago, f.fecha, f.moneda,
         f.cliente_id, f.cliente_numero, coalesce(f.cliente_nombre, c.nombre), f.total, f.pagado, f.saldo, f.version
    from public.facturas_filtradas(p_q, p_estado, p_moneda, p_desde, p_hasta, p_cliente_id) f
    join public.clientes c on c.id = f.cliente_id
   order by f.fecha desc, coalesce(f.numero, 0) desc, f.id desc
   limit greatest(1, least(coalesce(p_limite, 50), 500)) offset greatest(0, coalesce(p_desplazamiento, 0))
$$;

-- 3) Totales del filtro por moneda (las anuladas solo se cuentan)
create or replace function public.totales_facturas(
  p_q text default null, p_estado text default null, p_moneda text default null,
  p_desde date default null, p_hasta date default null, p_cliente_id bigint default null)
returns table (moneda text, cantidad bigint, anuladas bigint, total numeric, pagado numeric, saldo numeric)
language sql stable security invoker
set search_path = public, extensions
as $$
  select f.moneda, count(*), count(*) filter (where f.estado = 'anulada'),
         coalesce(sum(f.total) filter (where f.estado <> 'anulada'), 0),
         coalesce(sum(f.pagado) filter (where f.estado <> 'anulada'), 0),
         coalesce(sum(f.saldo), 0)
    from public.facturas_filtradas(p_q, p_estado, p_moneda, p_desde, p_hasta, p_cliente_id) f
   group by f.moneda
   order by f.moneda
$$;

-- 4) Último precio de cada producto para un cliente y moneda (sugerencia al facturar)
create or replace function public.ultimos_precios_cliente(p_cliente_id bigint, p_moneda text)
returns table (producto_id bigint, precio numeric, fecha date)
language sql stable security invoker
set search_path = public
as $$
  select distinct on (l.producto_id) l.producto_id, l.precio_unitario, f.fecha
    from public.factura_lineas l join public.facturas f on f.id = l.factura_id
   where f.cliente_id = p_cliente_id and f.moneda = p_moneda and f.estado = 'emitida'
   order by l.producto_id, f.fecha desc, f.id desc
$$;

-- 5) Permisos: nadie ejecuta funciones por la vía PUBLIC.
--    Antes de quitar PUBLIC se da permiso explícito a "authenticated" en las
--    funciones que hoy puede ejecutar (así nada de la app deja de funcionar);
--    las internas que ya le estaban negadas siguen negadas.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as firma
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    if has_function_privilege('authenticated', r.firma, 'execute') then
      execute format('grant execute on function %s to authenticated', r.firma);
    end if;
    execute format('revoke execute on function %s from public, anon', r.firma);
  end loop;
end $$;
grant execute on function public.empresa_publica() to anon;
grant execute on function public.facturas_filtradas(text, text, text, date, date, bigint) to authenticated;
grant execute on function public.buscar_facturas(text, text, text, date, date, bigint, int, int) to authenticated;
grant execute on function public.totales_facturas(text, text, text, date, date, bigint) to authenticated;
grant execute on function public.ultimos_precios_cliente(bigint, text) to authenticated;

-- Índice para buscar por producto dentro de las facturas
create index if not exists factura_lineas_descripcion_trgm
  on public.factura_lineas using gin (public.normalizar(descripcion) extensions.gin_trgm_ops);
