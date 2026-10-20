-- =====================================================================
-- Tierra Santa · Limpiar notas de entregas importadas que se cambiaron de modo
--
-- Las entregas importadas de la hoja anterior traen una nota como
-- "90 cestas de 30 kg × 2.000". Si después se editó la entrega a otro modo
-- (p. ej. por kilo), esa nota ya no es cierta. Esto la quita (el resto de la
-- nota, como "RESTANTE VIEJO", se conserva). No cambia montos ni kilos.
-- Uso: Supabase → SQL Editor → New query → pegar → Run. Se puede repetir.
-- =====================================================================
update public.entregas_proveedor
   set nota = nullif(trim(regexp_replace(nota, '^[0-9.,]+ cestas de [0-9.,]+ kg × [0-9.,]+( · )?', '')), '')
 where modo_pesaje <> 'VARIABLE'
   and nota ~ '^[0-9.,]+ cestas de [0-9.,]+ kg × [0-9.,]+'
returning fecha, (select nombre from public.proveedores where id = proveedor_id) as proveedor, modo_pesaje, total, nota;
