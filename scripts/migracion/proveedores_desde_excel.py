#!/usr/bin/env python3
"""
Tierra Santa · Migración de proveedores desde la hoja de cálculo anterior.

Lee el libro "SISTEMA DE PROVEEDORES" (una hoja por proveedor) y genera un
script SQL para pegar en Supabase → SQL Editor. El script:
  · crea los rubros que falten (como fruta de proveedores o insumo),
  · crea los proveedores, sus entregas, abonos y movimientos de cestas,
  · y al final compara el saldo y las cestas de cada proveedor con los que
    muestra la hoja: si alguno no cuadra (más de 1 en la moneda), deshace todo.

Uso:
  python3 -I scripts/migracion/proveedores_desde_excel.py LIBRO.xlsx COP salida.sql

Necesita openpyxl. El SQL generado tiene datos reales: no se sube al repositorio.

Estructura de cada hoja de proveedor (desde la fila 10):
  Entregas  B fecha · C rubro · D kg/cesta (si es por cesta) · E cestas · F kg total
            G precio (por cesta, o total si no hay kg/cesta) · I merma kg · J foto/nota
            L descuento por merma · M total a pagar
  Abonos    P fecha · Q monto
  Cestas    T fecha · U entregadas · V devueltas
Saldo de la hoja = suma(M) − suma(Q).

Cómo se guarda cada entrega (para que el total sea exactamente el de la hoja):
  · Fruta → modo VARIABLE ("precio total por un peso total", el modo para datos
    del sistema anterior): kg = F, precio = M + L, merma = I. Si era por cesta,
    las cestas y el precio por cesta quedan en la columna cestas y en la nota.
  · Insumos (etiquetas…) → modo UNIDAD: unidades = E, precio = G.
  · Fruta por unidad (piña) → modo UNIDAD: unidades = F ("KG TOTAL" en la hoja), precio = total / unidades.
  · Fila sin kilos → modo UNIDAD 1 × total, con nota para revisarla.
"""
import datetime
import sys
import unicodedata

import openpyxl

# Rubro de la hoja → (nombre del producto en el sistema, categoría, unidad, modo por defecto)
RUBROS = {
    "mora": ("Mora", "fruta", "kg", "KG"),
    "fresa": ("Fresa", "fruta", "kg", "KG"),
    "guanabana": ("Guanábana", "fruta", "kg", "KG"),
    "guanabana cesta": ("Guanábana", "fruta", "kg", "KG"),
    "parchita": ("Parchita", "fruta", "kg", "KG"),
    "durazno": ("Durazno", "fruta", "kg", "KG"),
    "pina": ("Piña", "fruta", "und", "UNIDAD"),
    "lulo": ("Lulo", "fruta", "kg", "KG"),
    "guayaba": ("Guayaba", "fruta", "kg", "KG"),
    "mango": ("Mango", "fruta", "kg", "KG"),
    "manga": ("Manga", "fruta", "kg", "KG"),
    "tamarindo": ("Tamarindo", "fruta", "kg", "KG"),
    "tomate de arbol": ("Tomate de árbol", "fruta", "kg", "KG"),
    "etiquetas": ("Etiquetas", "insumo", "und", "UNIDAD"),
}


def normalizar(t):
    t = unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode()
    return " ".join(t.lower().split())


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def fecha(v):
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    return None


def sql(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(round(v, 6))
    return "'" + str(v).replace("'", "''") + "'"


def miles(v, dec=0):
    s = f"{v:,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def leer(ruta):
    wb = openpyxl.load_workbook(ruta, data_only=True)
    panel = wb["Panel de Control"]
    hojas = {ws.title: ws for ws in wb.worksheets}
    proveedores, avisos = [], []
    for r in range(9, panel.max_row + 1):
        hoja = panel.cell(r, 5).value  # columna E (oculta): nombre de la hoja
        if not hoja:
            continue
        ws = hojas.get(str(hoja)[:31])
        if ws is None:
            avisos.append(f"El panel nombra la hoja «{hoja}» pero no existe")
            continue
        nombre = " ".join(str(panel.cell(r, 2).value or hoja).split())
        p = {"nombre": nombre, "saldo": num(panel.cell(r, 3).value) or 0,
             "cestas_pend": num(panel.cell(r, 4).value) or 0, "entregas": [], "abonos": [], "cestas": []}
        for f in range(10, ws.max_row + 1):
            c = lambda col: ws[f"{col}{f}"].value  # noqa: E731
            if any(c(x) not in (None, "") for x in "BCEFG"):
                p["entregas"].append(entrega(p["nombre"], f, c, avisos))
            if c("P") not in (None, "") or c("Q") not in (None, ""):
                if not fecha(c("P")) or not num(c("Q")) or c("Q") <= 0:
                    raise SystemExit(f"{nombre}, fila {f}: abono incompleto ({c('P')!r}, {c('Q')!r})")
                p["abonos"].append({"fecha": fecha(c("P")), "monto": round(c("Q"), 2)})
            if any(num(c(x)) for x in "UV"):
                if not fecha(c("T")):
                    raise SystemExit(f"{nombre}, fila {f}: movimiento de cestas sin fecha")
                ent, dev = num(c("U")) or 0, num(c("V")) or 0
                if ent != int(ent) or dev != int(dev):
                    raise SystemExit(f"{nombre}, fila {f}: cestas con decimales ({ent}, {dev})")
                p["cestas"].append({"fecha": fecha(c("T")), "ent": int(ent), "dev": int(dev)})
        # La hoja calcula el saldo con los totales que muestra: se comprueba aquí también
        calc = sum(e["total_hoja"] for e in p["entregas"]) - sum(a["monto"] for a in p["abonos"])
        if abs(calc - p["saldo"]) > 0.01:
            avisos.append(f"{nombre}: el saldo del panel ({p['saldo']}) no es entregas − abonos ({calc})")
        p["tipo"] = "insumos" if p["entregas"] and all(RUBROS[e["rubro"]][1] == "insumo" for e in p["entregas"]) else "fruta"
        proveedores.append(p)
    return proveedores, avisos


def entrega(prov, f, c, avisos):
    donde = f"{prov}, fila {f}"
    if not fecha(c("B")):
        raise SystemExit(f"{donde}: entrega sin fecha")
    rubro = normalizar(c("C"))
    if rubro not in RUBROS:
        raise SystemExit(f"{donde}: rubro desconocido «{c('C')}» (agrégalo a RUBROS)")
    total, desc = num(c("M")), num(c("L")) or 0
    if total is None:
        raise SystemExit(f"{donde}: sin total a pagar")
    merma = num(c("I")) or 0
    kg_cesta, cestas, precio_hoja = num(c("D")), num(c("E")), num(c("G"))
    extra = c("J") if isinstance(c("J"), str) else None
    foto = extra.strip() if extra and extra.strip().lower().startswith("http") else None
    notas = [] if foto or not extra or not extra.strip() else [extra.strip()]
    e = {"fecha": fecha(c("B")), "rubro": rubro, "total_hoja": total, "foto": foto, "merma": 0, "cestas": 0}

    if RUBROS[rubro][1] == "insumo":
        e.update(modo="UNIDAD", kg=0, unidades=cestas, precio=precio_hoja)
        if cestas is None or precio_hoja is None or abs(cestas * precio_hoja - total) > 0.01:
            raise SystemExit(f"{donde}: insumo sin unidades × precio que dé el total")
    else:
        kg = num(c("F")) or num(c("K")) or (cestas * kg_cesta if cestas and kg_cesta else None)
        if kg and RUBROS[rubro][3] == "UNIDAD":
            # Fruta que se compra por unidad (piña): la columna "KG TOTAL" de la hoja son unidades
            precio = round((total + desc) / kg, 2)
            if abs(kg * precio - (total + desc)) > 0.01:
                raise SystemExit(f"{donde}: {c('C')} por unidad, pero {kg} × {precio} no da el total {total + desc}")
            e.update(modo="UNIDAD", kg=0, unidades=kg, precio=precio, merma=round(merma, 3))
        elif not kg:
            e.update(modo="UNIDAD", kg=0, unidades=1, precio=round(total, 2))
            notas.append("Sin kilos en la hoja anterior" + (f" ({miles(cestas, 2)} cestas)" if cestas else "") + "; revisar")
            avisos.append(f"{donde}: {c('C')} sin kilos; se guarda solo el total {miles(total)}")
        else:
            e.update(modo="VARIABLE", kg=round(kg, 3), unidades=0, precio=round(total + desc, 2), merma=round(merma, 3))
            if kg_cesta and cestas:
                e["cestas"] = round(cestas, 2)
                notas.insert(0, f"{miles(cestas, 2).rstrip('0').rstrip(',')} cestas de {miles(kg_cesta)} kg × {miles(precio_hoja)}")
    e["nota"] = " · ".join(notas) or None
    return e


def generar(proveedores, moneda, origen):
    """Todo va en un solo bloque DO: el SQL Editor de Supabase ejecuta cada
    sentencia por separado, y un bloque es una sola sentencia (todo o nada)."""
    L = []
    w = L.append
    n_ent = sum(len(p["entregas"]) for p in proveedores)
    n_abo = sum(len(p["abonos"]) for p in proveedores)
    n_ces = sum(len(p["cestas"]) for p in proveedores)
    col = {"COP": "saldo_cop", "USD": "saldo_usd", "VES": "saldo_ves"}[moneda]
    nombres = ", ".join(sql(normalizar(p["nombre"])) for p in proveedores)
    usados = sorted({e["rubro"] for p in proveedores for e in p["entregas"]})
    # Producto de cada rubro (se busca por nombre al momento de insertar)
    rubros_values = ", ".join(f"({sql(r)}, {sql(RUBROS[r][0])})" for r in usados)
    join_rubro = ("  join (values " + rubros_values + ") m(clave, nombre) on m.clave = v.rubro\n"
                  "  cross join lateral (select pr.id from public.productos pr\n"
                  "     where public.normalizar(pr.nombre) = public.normalizar(m.nombre) and pr.tipo <> 'terminado'\n"
                  "     order by pr.activo desc, pr.id limit 1) prod")

    w("-- =====================================================================")
    w(f"-- Tierra Santa · Migración de proveedores ({moneda}) desde la hoja anterior")
    w(f"-- Origen: {origen}")
    w(f"-- {len(proveedores)} proveedores · {n_ent} entregas · {n_abo} abonos · {n_ces} movimientos de cestas")
    w("--")
    w("-- Uso: Supabase → SQL Editor → New query → pegar todo → Run.")
    w("-- Es un solo bloque: si un saldo no cuadra con la hoja, o los proveedores")
    w("-- ya existen, da error y NO se guarda nada.")
    w("-- =====================================================================")
    w("do $migracion$")
    w("declare r record; v_id bigint; v text; n int;")
    w("begin")
    w("  -- 0) No importar dos veces")
    w(f"  select string_agg(nombre, ', ') into v from public.proveedores where public.normalizar(nombre) in ({nombres});")
    w("  if v is not null then raise exception 'Estos proveedores ya existen (¿ya se importó?): %', v; end if;")
    w("")
    w("  -- 1) Rubros: se usan los productos existentes por nombre; los que falten se crean")
    w("  for r in select * from (values")
    w(",\n".join(f"      ({sql(RUBROS[x][0])}, {sql(RUBROS[x][1])}, {sql(RUBROS[x][2])}, {sql(RUBROS[x][3])})"
                 for x in sorted({RUBROS[u][0]: u for u in usados}.values())))
    w("    ) t(nombre, categoria, unidad, modo) loop")
    w("    if not exists (select 1 from public.productos")
    w("                    where public.normalizar(nombre) = public.normalizar(r.nombre) and tipo <> 'terminado') then")
    w("      insert into public.productos (codigo, nombre, unidad, tipo, categoria, modo_pesaje)")
    w("      values ((select greatest(coalesce(max(codigo), 900), 900) + 1 from public.productos where codigo > 900),")
    w("              r.nombre, r.unidad, 'materia_prima', r.categoria, r.modo);")
    w("      raise notice 'Rubro creado: %', r.nombre;")
    w("    end if;")
    w("  end loop;")
    w("")
    w("  -- 2) Proveedores")
    w("  insert into public.proveedores (nombre, moneda_habitual, tipo, notas) values")
    w(",\n".join(f"    ({sql(p['nombre'])}, {sql(moneda)}, {sql(p['tipo'])}, 'Importado de la hoja anterior')" for p in proveedores) + ";")
    w("")
    if n_ent:
        w("  -- 3) Entregas (el total lo calcula el sistema)")
        w("  insert into public.entregas_proveedor (proveedor_id, fecha, producto_id, moneda, modo_pesaje, cestas, kg_total, unidades, precio, merma, foto_url, nota)")
        w(f"  select p.id, v.fecha::date, prod.id, {sql(moneda)}, v.modo, v.cestas::numeric, v.kg::numeric, v.unidades::numeric,")
        w("         v.precio::numeric, v.merma::numeric, v.foto, v.nota")
        w("  from (values")
        w(",\n".join(f"    ({sql(p['nombre'])}, {sql(e['fecha'])}, {sql(e['rubro'])}, {sql(e['modo'])}, {sql(e['cestas'])}, {sql(e['kg'])}, "
                     f"{sql(e['unidades'])}, {sql(e['precio'])}, {sql(e['merma'])}, {sql(e['foto'])}, {sql(e['nota'])}, {i})"
                     for i, (p, e) in enumerate((p, e) for p in proveedores for e in p["entregas"])))
        w("  ) v(proveedor, fecha, rubro, modo, cestas, kg, unidades, precio, merma, foto, nota, orden)")
        w("  join public.proveedores p on public.normalizar(p.nombre) = public.normalizar(v.proveedor)")
        w(join_rubro)
        w("  order by v.fecha::date, v.orden;")
        w("  get diagnostics n = row_count;")
        w(f"  if n <> {n_ent} then raise exception 'Se esperaban {n_ent} entregas y se guardaron %; no se guardó nada', n; end if;")
        w("")
    if n_abo:
        w("  -- 4) Abonos (los números de recibo siguen el orden de las fechas)")
        w("  insert into public.abonos_proveedor (proveedor_id, fecha, moneda, monto, nota)")
        w(f"  select p.id, v.fecha::date, {sql(moneda)}, v.monto::numeric, 'Importado de la hoja anterior'")
        w("  from (values")
        w(",\n".join(f"    ({sql(p['nombre'])}, {sql(a['fecha'])}, {sql(a['monto'])}, {i})"
                     for i, (p, a) in enumerate((p, a) for p in proveedores for a in p["abonos"])))
        w("  ) v(proveedor, fecha, monto, orden)")
        w("  join public.proveedores p on public.normalizar(p.nombre) = public.normalizar(v.proveedor)")
        w("  order by v.fecha::date, v.orden;")
        w("")
    if n_ces:
        w("  -- 5) Cestas entregadas / devueltas")
        w("  insert into public.cestas_proveedor (proveedor_id, fecha, entregadas, devueltas, nota)")
        w("  select p.id, v.fecha::date, v.ent::int, v.dev::int, 'Importado de la hoja anterior'")
        w("  from (values")
        w(",\n".join(f"    ({sql(p['nombre'])}, {sql(c['fecha'])}, {c['ent']}, {c['dev']})" for p in proveedores for c in p["cestas"]))
        w("  ) v(proveedor, fecha, ent, dev)")
        w("  join public.proveedores p on public.normalizar(p.nombre) = public.normalizar(v.proveedor);")
        w("")
    w("  -- 6) Comprobación contra la hoja: si algo no cuadra, se deshace todo")
    w("  select string_agg(format('%s: hoja %s / sistema %s (cestas %s / %s, entregas %s / %s, abonos %s / %s)',")
    w(f"           x.proveedor, x.saldo, s.{col}, x.cestas, s.cestas_pendientes, x.entregas,")
    w("           (select count(*) from public.entregas_proveedor e where e.proveedor_id = s.id),")
    w("           x.abonos, (select count(*) from public.abonos_proveedor a where a.proveedor_id = s.id)), E'\\n')")
    w("    into v")
    w("    from (values")
    w(",\n".join(f"      ({sql(p['nombre'])}, {sql(round(p['saldo'], 4))}, {p['cestas_pend']}, {len(p['entregas'])}, {len(p['abonos'])})" for p in proveedores))
    w("    ) x(proveedor, saldo, cestas, entregas, abonos)")
    w("    left join public.v_resumen_proveedores s on public.normalizar(s.nombre) = public.normalizar(x.proveedor)")
    w(f"   where s.id is null or abs(s.{col} - x.saldo) > 1 or s.cestas_pendientes <> x.cestas")
    w("      or (select count(*) from public.entregas_proveedor e where e.proveedor_id = s.id) <> x.entregas")
    w("      or (select count(*) from public.abonos_proveedor a where a.proveedor_id = s.id) <> x.abonos;")
    w("  if v is not null then raise exception E'No cuadra con la hoja; no se guardó nada:\\n%', v; end if;")
    w("")
    w("  insert into public.audit_log (usuario, accion, tabla, nota)")
    w(f"  values ('sistema', 'IMPORTAR', 'proveedores', {sql(f'Migración de proveedores en {moneda}: {len(proveedores)} proveedores, {n_ent} entregas, {n_abo} abonos')});")
    w("end $migracion$;")
    w("")
    w("-- Resultado: saldo de cada proveedor importado (igual al de la hoja)")
    w(f"select nombre, {col} saldo, cestas_pendientes from public.v_resumen_proveedores")
    w(f" where public.normalizar(nombre) in ({nombres}) order by {col} desc;")
    return "\n".join(L) + "\n"


def main():
    if len(sys.argv) != 4 or sys.argv[2] not in ("COP", "USD", "VES"):
        raise SystemExit(__doc__)
    ruta, moneda, salida = sys.argv[1:]
    proveedores, avisos = leer(ruta)
    with open(salida, "w", encoding="utf-8") as f:
        f.write(generar(proveedores, moneda, ruta.rsplit("/", 1)[-1]))
    total = sum(p["saldo"] for p in proveedores)
    print(f"{len(proveedores)} proveedores · {sum(len(p['entregas']) for p in proveedores)} entregas · "
          f"{sum(len(p['abonos']) for p in proveedores)} abonos · {sum(len(p['cestas']) for p in proveedores)} cestas · "
          f"saldo total {miles(total, 2)} {moneda}")
    for p in proveedores:
        if p["tipo"] != "fruta":
            print(f"  proveedor de {p['tipo']}: {p['nombre']}")
    for a in avisos:
        print("  AVISO:", a)
    print("SQL:", salida)


if __name__ == "__main__":
    main()
