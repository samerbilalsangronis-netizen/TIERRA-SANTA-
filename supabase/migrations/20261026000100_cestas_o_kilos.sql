-- =====================================================================
-- Tierra Santa · Compra por cesta: se escribe en cestas O en kilos
--
-- Antes, en el modo "Por cesta" solo se escribían las cestas y el sistema
-- calculaba los kilos. Ahora se puede escribir cualquiera de los dos:
--   · cestas → kg = cestas × kg por cesta
--   · kilos  → cestas = kg ÷ kg por cesta (p. ej. 11 kg de mora = 0,7333 cestas)
-- El total sale de los kilos: total = kg × precio por cesta ÷ kg por cesta
-- (con cestas enteras es lo mismo que cestas × precio por cesta).
-- Las cestas guardan hasta 4 decimales.
-- =====================================================================

alter table public.entregas_proveedor alter column cestas type numeric(12,4);

-- Cálculo (misma firma): en FIJO manda el kg si viene, si no las cestas
create or replace function public.calcular_entrega(
  p_modo text, p_kg_por_cesta numeric, p_cestas numeric, p_kg_total numeric, p_unidades numeric,
  p_precio numeric, p_merma numeric,
  out kg_total numeric, out precio_kg numeric, out desc_merma numeric, out total numeric, out peso_neto numeric)
language plpgsql immutable
as $$
declare v_merma numeric := coalesce(p_merma, 0); v_cant numeric;
begin
  if p_modo = 'KG' then
    if coalesce(p_kg_total, 0) <= 0 then raise exception 'Indica los kilos recibidos.'; end if;
    if v_merma > p_kg_total then raise exception 'La merma (% kg) no puede superar los kilos recibidos (% kg).', v_merma, p_kg_total; end if;
    kg_total := p_kg_total;
    precio_kg := p_precio;
    desc_merma := round(v_merma * p_precio, 2);
    total := round(p_kg_total * p_precio, 2) - desc_merma;
    peso_neto := p_kg_total - v_merma;
  elsif p_modo = 'UNIDAD' then
    v_cant := coalesce(p_unidades, 0);
    if v_cant <= 0 then raise exception 'Indica las unidades recibidas.'; end if;
    if v_merma > v_cant then raise exception 'Las unidades dañadas (%) no pueden superar las recibidas (%).', v_merma, v_cant; end if;
    kg_total := 0;
    precio_kg := p_precio;                        -- precio por unidad
    desc_merma := round(v_merma * p_precio, 2);
    total := round(v_cant * p_precio, 2) - desc_merma;
    peso_neto := 0;
  elsif p_modo = 'FIJO' then
    if coalesce(p_kg_por_cesta, 0) <= 0 then raise exception 'La compra por cesta requiere kg por cesta mayor a 0.'; end if;
    kg_total := case when coalesce(p_kg_total, 0) > 0 then p_kg_total
                     else round(coalesce(p_cestas, 0) * p_kg_por_cesta, 3) end;
    if kg_total <= 0 then raise exception 'Indica las cestas o los kilos.'; end if;
    if v_merma > kg_total then raise exception 'La merma (% kg) no puede superar el peso total (% kg).', v_merma, kg_total; end if;
    precio_kg := round(p_precio / p_kg_por_cesta, 4);
    desc_merma := round(v_merma * p_precio / p_kg_por_cesta, 2);
    total := round(kg_total * p_precio / p_kg_por_cesta, 2) - desc_merma;
    peso_neto := kg_total - v_merma;
  elsif p_modo = 'VARIABLE' then
    if coalesce(p_kg_total, 0) <= 0 then raise exception 'Indica el total de kg.'; end if;
    if v_merma > p_kg_total then raise exception 'La merma (% kg) no puede superar el peso total (% kg).', v_merma, p_kg_total; end if;
    kg_total := p_kg_total;
    precio_kg := round(p_precio / p_kg_total, 4);
    desc_merma := round(v_merma * p_precio / p_kg_total, 2);
    total := p_precio - desc_merma;
    peso_neto := p_kg_total - v_merma;
  else
    raise exception 'Modo de compra no válido: %', p_modo;
  end if;
end $$;

-- Trigger: en FIJO, si al editar cambian las cestas pero no los kilos, los
-- kilos se recalculan desde las cestas; y las cestas siempre quedan = kg ÷ kg/cesta.
create or replace function public.tg_entrega_calcular()
returns trigger language plpgsql as $$
declare v_prod public.productos; r record;
begin
  if tg_op = 'INSERT' or new.producto_id <> old.producto_id or new.modo_pesaje is distinct from old.modo_pesaje then
    select * into v_prod from public.productos where id = new.producto_id;
    new.modo_pesaje := coalesce(new.modo_pesaje, v_prod.modo_pesaje);
    if new.modo_pesaje = 'FIJO' and (new.kg_por_cesta is null or tg_op = 'UPDATE' and new.producto_id <> old.producto_id) then
      new.kg_por_cesta := v_prod.kg_por_cesta;
    end if;
  end if;
  if new.modo_pesaje = 'FIJO' and tg_op = 'UPDATE'
     and new.cestas is distinct from old.cestas and new.kg_total is not distinct from old.kg_total then
    new.kg_total := 0;
  end if;
  select * into r from public.calcular_entrega(new.modo_pesaje, new.kg_por_cesta, new.cestas,
                                               new.kg_total, new.unidades, new.precio, new.merma);
  new.kg_total := r.kg_total; new.precio_kg := r.precio_kg; new.desc_merma := r.desc_merma;
  new.total := r.total; new.peso_neto := r.peso_neto;
  if new.modo_pesaje = 'FIJO' then
    new.cestas := round(r.kg_total / new.kg_por_cesta, 4);
  end if;
  return new;
end $$;
