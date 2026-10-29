import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { numeroFactura } from "@/lib/facturas";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";

export type TipoColumna = "texto" | "fecha" | "cantidad" | "monto" | "entero" | "porcentaje";
export type Columna = { titulo: string; tipo: TipoColumna; /** Moneda propia de una columna de monto. */ moneda?: string };
export type Celda = string | number | null;
export type Reporte = {
  titulo: string; columnas: Columna[]; filas: Celda[][]; totales?: Celda[]; nota?: string; moneda?: string;
  /** Líneas extra para el encabezado de la hoja (p. ej. el resumen de facturas). */
  lineas?: string[];
};
export type Filtros = {
  desde: string; hasta: string; moneda: string; proveedorId?: number | null;
  /** Saldos de proveedores: solo los que traen esta fruta, solo estos proveedores, solo con saldo. */
  rubroId?: number | null; seleccion?: number[] | null; soloConSaldo?: boolean;
  /** Ventas a un cliente: el cliente elegido. */
  clienteId?: number | null;
};

export const REPORTES = {
  "ventas-producto": { titulo: "Ventas por producto", descripcion: "Bolsas vendidas de cada producto, sumando dólares y pesos, con el monto en cada moneda.", moneda: false, proveedor: false, periodo: true, eleccion: false, cliente: false },
  "cliente-producto": { titulo: "Ventas a un cliente", descripcion: "Elige un cliente y el periodo: sus facturas y la suma de cada producto que se llevó.", moneda: false, proveedor: false, periodo: true, eleccion: false, cliente: true },
  "ventas-cliente": { titulo: "Ventas por cliente", descripcion: "Cuánto compró cada cliente y cuánto debe de esas facturas.", moneda: true, proveedor: false, periodo: true, eleccion: false, cliente: false },
  "libro-facturas": { titulo: "Libro de facturas", descripcion: "Todas las facturas del periodo, incluidas las anuladas.", moneda: true, proveedor: false, periodo: true, eleccion: false, cliente: false },
  "fruta-recibida": { titulo: "Fruta recibida", descripcion: "Kilos y cestas de cada fruta que entregaron los proveedores; también de un solo proveedor.", moneda: false, proveedor: true, periodo: true, eleccion: false, cliente: false },
  "saldos-proveedores": { titulo: "Saldos de proveedores", descripcion: "Lo que se le debe a cada proveedor, con totales. Filtra por la fruta que traen o elige los proveedores.", moneda: false, proveedor: false, periodo: false, eleccion: true, cliente: false },
  "compras-proveedor": { titulo: "Compras por proveedor", descripcion: "Entregas por proveedor y fruta, con kilos y merma.", moneda: false, proveedor: false, periodo: true, eleccion: false, cliente: false },
  "gastos": { titulo: "Gastos por categoría", descripcion: "Lo gastado en guantes, aditivos, gasolina… por categoría y concepto, en pesos y dólares.", moneda: false, proveedor: false, periodo: true, eleccion: false, cliente: false },
  "produccion": { titulo: "Producción diaria", descripcion: "Bolsas producidas por día y producto.", moneda: false, proveedor: false, periodo: true, eleccion: false, cliente: false },
  "cajas-cestas": { titulo: "Cajas y cestas", descripcion: "Cajas con clientes y cestas con proveedores: movimiento y pendientes.", moneda: false, proveedor: false, periodo: true, eleccion: false, cliente: false },
} as const;
export type TipoReporte = keyof typeof REPORTES;
export const esTipoReporte = (t: string): t is TipoReporte => t in REPORTES;

const n = (v: unknown) => Number(v ?? 0);
const suma = (filas: Celda[][], i: number) => filas.reduce((a, f) => a + n(f[i]), 0);

/** Genera un reporte (los cálculos los hace Postgres; aquí solo se arma la tabla). */
export async function generarReporte(tipo: TipoReporte, f: Filtros): Promise<Reporte> {
  const supabase = await crearClienteServidor();
  const titulo = REPORTES[tipo].titulo;

  if (tipo === "ventas-producto") {
    // Un solo reporte con todas las monedas: la cantidad se suma y el monto va en una columna por moneda
    const { data: monedas } = await supabase.from("monedas").select("codigo").eq("activa", true).order("orden");
    const lista = (monedas ?? []).map((m) => m.codigo);
    const porMoneda = await Promise.all(lista.map(async (m) => ({
      m, data: (await supabase.rpc("ventas_por_producto", { p_desde: f.desde, p_hasta: f.hasta, p_moneda: m })).data ?? [] })));
    // Columnas de monto: USD y COP siempre; otras monedas solo si tuvieron ventas
    const usadas = porMoneda.filter((x) => x.m === "USD" || x.m === "COP" || x.data.length > 0).map((x) => x.m);
    const productos = new Map<number, { codigo: number; nombre: string; unidad: string; cantidad: number; facturas: number; montos: Record<string, number> }>();
    for (const { m, data } of porMoneda) {
      for (const x of data) {
        const p = productos.get(x.producto_id) ?? { codigo: x.codigo, nombre: x.nombre, unidad: x.unidad, cantidad: 0, facturas: 0, montos: {} };
        p.cantidad += n(x.cantidad); p.facturas += n(x.facturas); p.montos[m] = (p.montos[m] ?? 0) + n(x.monto);
        productos.set(x.producto_id, p);
      }
    }
    const filas: Celda[][] = [...productos.values()].sort((a, b) => b.cantidad - a.cantidad)
      .map((p) => [p.codigo, p.nombre, p.unidad, p.cantidad, p.facturas, ...usadas.map((m) => p.montos[m] ?? null)]);
    return { titulo, nota: "Cantidad: todas las facturas, en dólares y en pesos. Montos sin IVA, cada uno en su moneda.",
      columnas: [{ titulo: "Código", tipo: "entero" }, { titulo: "Producto", tipo: "texto" }, { titulo: "Unidad", tipo: "texto" }, { titulo: "Cantidad", tipo: "cantidad" }, { titulo: "Facturas", tipo: "entero" },
        ...usadas.map((m) => ({ titulo: `Monto ${m}`, tipo: "monto" as const, moneda: m }))],
      filas, totales: ["", "Total", "", suma(filas, 3), suma(filas, 4), ...usadas.map((_, i) => suma(filas, 5 + i))] };
  }
  if (tipo === "cliente-producto") {
    const columnasBase: Columna[] = [{ titulo: "Código", tipo: "entero" }, { titulo: "Producto", tipo: "texto" }, { titulo: "Unidad", tipo: "texto" },
      { titulo: "Cantidad", tipo: "cantidad" }, { titulo: "Veces que cargó", tipo: "entero" }];
    if (!f.clienteId) return { titulo, columnas: columnasBase, filas: [], nota: "Elige un cliente arriba para ver lo que se llevó." };
    const [{ data: ventas }, { data: facturas }] = await Promise.all([
      supabase.rpc("ventas_cliente_por_producto", { p_cliente_id: f.clienteId, p_desde: f.desde, p_hasta: f.hasta }),
      supabase.rpc("totales_facturas", { p_cliente_id: f.clienteId, p_desde: f.desde, p_hasta: f.hasta }),
    ]);
    // Monto en una columna por moneda (USD y COP siempre, otras si hubo ventas)
    const usadas = [...new Set(["USD", "COP", ...(ventas ?? []).map((x) => x.moneda)])];
    const productos = new Map<number, { codigo: number; nombre: string; unidad: string; cantidad: number; facturas: number; montos: Record<string, number> }>();
    for (const x of ventas ?? []) {
      const p = productos.get(x.producto_id) ?? { codigo: x.codigo, nombre: x.nombre, unidad: x.unidad, cantidad: 0, facturas: 0, montos: {} };
      p.cantidad += n(x.cantidad); p.facturas += n(x.facturas); p.montos[x.moneda] = (p.montos[x.moneda] ?? 0) + n(x.monto);
      productos.set(x.producto_id, p);
    }
    const filas: Celda[][] = [...productos.values()].sort((a, b) => b.cantidad - a.cantidad)
      .map((p) => [p.codigo, p.nombre, p.unidad, p.cantidad, p.facturas, ...usadas.map((m) => p.montos[m] ?? null)]);
    const resumen = (facturas ?? []).filter((x) => n(x.cantidad) - n(x.anuladas) > 0);
    const nFacturas = resumen.reduce((a, x) => a + n(x.cantidad) - n(x.anuladas), 0);
    return { titulo,
      lineas: [nFacturas ? `${nFacturas} factura${nFacturas === 1 ? "" : "s"} en el periodo: ${resumen.map((x) => formatearMonto(x.total, x.moneda)).join(" + ")}` : "Sin facturas en el periodo"],
      nota: "Cantidad: suma de todas las facturas del periodo (en dólares y en pesos). Montos sin IVA. Las facturas históricas importadas no traen el detalle de productos.",
      columnas: [...columnasBase, ...usadas.map((m) => ({ titulo: `Monto ${m}`, tipo: "monto" as const, moneda: m }))],
      filas, totales: ["", "Total", "", suma(filas, 3), null, ...usadas.map((_, i) => suma(filas, 5 + i))] };
  }
  if (tipo === "ventas-cliente") {
    const { data } = await supabase.rpc("ventas_por_cliente", { p_desde: f.desde, p_hasta: f.hasta, p_moneda: f.moneda });
    const filas: Celda[][] = (data ?? []).map((x) => [x.numero, x.nombre, n(x.facturas), n(x.total), n(x.pagado), n(x.saldo)]);
    return { titulo, moneda: f.moneda,
      columnas: [{ titulo: "Nº", tipo: "entero" }, { titulo: "Cliente", tipo: "texto" }, { titulo: "Facturas", tipo: "entero" }, { titulo: "Total", tipo: "monto" }, { titulo: "Pagado", tipo: "monto" }, { titulo: "Debe", tipo: "monto" }],
      filas, totales: ["", "Total", suma(filas, 2), suma(filas, 3), suma(filas, 4), suma(filas, 5)] };
  }
  if (tipo === "libro-facturas") {
    const [{ data }, { data: emp }] = await Promise.all([
      supabase.rpc("buscar_facturas", { p_desde: f.desde, p_hasta: f.hasta, p_moneda: f.moneda, p_limite: 500 }),
      supabase.from("empresa").select("factura_prefijo").eq("id", 1).single(),
    ]);
    const filas: Celda[][] = [...(data ?? [])].reverse().map((x) => [
      x.fecha, numeroFactura(x, emp?.factura_prefijo ?? ""), x.origen === "externa" ? "Histórica" : "Sistema", x.cliente_nombre,
      x.estado === "anulada" ? "Anulada" : { pendiente: "Pendiente", abonada: "Abonada", pagada: "Pagada" }[x.estado_pago] ?? x.estado_pago,
      x.estado === "anulada" ? 0 : n(x.total), x.estado === "anulada" ? 0 : n(x.pagado), n(x.saldo)]);
    return { titulo, moneda: f.moneda, nota: (data ?? []).length >= 500 ? "Se muestran las primeras 500 facturas; reduce el rango." : "Las anuladas suman 0.",
      columnas: [{ titulo: "Fecha", tipo: "fecha" }, { titulo: "Factura", tipo: "texto" }, { titulo: "Origen", tipo: "texto" }, { titulo: "Cliente", tipo: "texto" }, { titulo: "Estado", tipo: "texto" },
        { titulo: "Total", tipo: "monto" }, { titulo: "Pagado", tipo: "monto" }, { titulo: "Saldo", tipo: "monto" }],
      filas, totales: ["", "Total", "", `${filas.length} facturas`, "", suma(filas, 5), suma(filas, 6), suma(filas, 7)] };
  }
  if (tipo === "compras-proveedor") {
    const { data } = await supabase.rpc("compras_por_proveedor", { p_desde: f.desde, p_hasta: f.hasta });
    const filas: Celda[][] = (data ?? []).map((x) => [x.proveedor, x.rubro, x.moneda, n(x.entregas), n(x.kg) || (n(x.unidades) ? `${n(x.unidades)} und` : 0), n(x.merma), x.merma_pct === null ? null : n(x.merma_pct), n(x.total)]);
    return { titulo, nota: "Los totales se suman por moneda en el Excel; en pantalla cada fila indica su moneda.",
      columnas: [{ titulo: "Proveedor", tipo: "texto" }, { titulo: "Fruta / insumo", tipo: "texto" }, { titulo: "Moneda", tipo: "texto" }, { titulo: "Entregas", tipo: "entero" },
        { titulo: "Kg", tipo: "cantidad" }, { titulo: "Merma kg", tipo: "cantidad" }, { titulo: "Merma %", tipo: "porcentaje" }, { titulo: "Total", tipo: "monto" }],
      filas };
  }
  if (tipo === "fruta-recibida") {
    const { data } = await supabase.rpc("fruta_recibida", { p_desde: f.desde, p_hasta: f.hasta, ...(f.proveedorId ? { p_proveedor_id: f.proveedorId } : {}) });
    const totalNeto = (data ?? []).reduce((a, x) => a + n(x.kg_neto), 0);
    const filas: Celda[][] = (data ?? []).map((x) => [
      `${x.emoji ?? ""} ${x.rubro}`.trim(), n(x.entregas), n(x.proveedores), n(x.kg) || null, n(x.merma) || null, n(x.kg_neto) || null,
      totalNeto && n(x.kg_neto) ? (n(x.kg_neto) * 100) / totalNeto : null, n(x.cestas) || null, n(x.unidades) || null]);
    return { titulo,
      nota: "Se suma de las entregas de los proveedores. Kg netos = kg recibidos − merma. Las cestas son las anotadas en cada entrega; la piña se cuenta en unidades.",
      columnas: [{ titulo: "Fruta", tipo: "texto" }, { titulo: "Entregas", tipo: "entero" }, { titulo: "Proveedores", tipo: "entero" }, { titulo: "Kg recibidos", tipo: "cantidad" },
        { titulo: "Merma kg", tipo: "cantidad" }, { titulo: "Kg netos", tipo: "cantidad" }, { titulo: "% de los kg", tipo: "porcentaje" }, { titulo: "Cestas", tipo: "cantidad" }, { titulo: "Unidades", tipo: "cantidad" }],
      filas, totales: ["Total", suma(filas, 1), null, suma(filas, 3), suma(filas, 4), suma(filas, 5), null, suma(filas, 7), suma(filas, 8)] };
  }
  if (tipo === "saldos-proveedores") {
    const { data } = await supabase.rpc("buscar_proveedores", {
      ...(f.rubroId ? { p_producto: f.rubroId } : {}), ...(f.soloConSaldo ? { p_con_saldo: true } : {}),
    });
    const lista = (data ?? []).flatMap((x) => (x.id !== null && (!f.seleccion?.length || f.seleccion.includes(x.id)) ? [{ ...x, id: x.id }] : []));
    // Frutas que trae cada proveedor (de sus entregas)
    const { data: entregas } = lista.length
      ? await supabase.from("entregas_proveedor").select("proveedor_id, productos(nombre)").in("proveedor_id", lista.map((x) => x.id)).limit(50000)
      : { data: [] };
    const frutas = new Map<number, Set<string>>();
    for (const e of entregas ?? []) {
      if (!e.productos?.nombre) continue;
      (frutas.get(e.proveedor_id) ?? frutas.set(e.proveedor_id, new Set()).get(e.proveedor_id)!).add(e.productos.nombre);
    }
    const filas: Celda[][] = lista.map((x) => [x.nombre, [...(frutas.get(x.id) ?? [])].sort().join(", ") || "—",
      x.ultima_entrega, n(x.saldo_cop) || null, n(x.saldo_usd) || null, n(x.cestas_pendientes) || null]);
    return { titulo,
      nota: "Saldo al día de hoy: todo lo entregado menos todo lo abonado. Un saldo negativo es lo que se le pagó de más.",
      columnas: [{ titulo: "Proveedor", tipo: "texto" }, { titulo: "Fruta que trae", tipo: "texto" }, { titulo: "Última entrega", tipo: "fecha" },
        { titulo: "Debe COP", tipo: "monto", moneda: "COP" }, { titulo: "Debe USD", tipo: "monto", moneda: "USD" }, { titulo: "Cestas pend.", tipo: "entero" }],
      filas, totales: [`Total (${filas.length} proveedores)`, "", "", suma(filas, 3), suma(filas, 4), suma(filas, 5)] };
  }
  if (tipo === "gastos") {
    const { data } = await supabase.rpc("gastos_resumen", { p_desde: f.desde, p_hasta: f.hasta });
    const usadas = [...new Set(["COP", "USD", ...(data ?? []).map((x) => x.moneda)])];
    // Una fila por concepto (las monedas en columnas), en el orden de las categorías
    const conceptos = new Map<number, { categoria: string; concepto: string; veces: number; cantidad: number; unidad: string; montos: Record<string, number> }>();
    for (const x of data ?? []) {
      const c = conceptos.get(x.concepto_id) ?? { categoria: x.categoria, concepto: x.concepto, veces: 0, cantidad: 0, unidad: x.unidad ?? "", montos: {} };
      c.veces += n(x.veces); c.cantidad += n(x.cantidad); c.montos[x.moneda] = (c.montos[x.moneda] ?? 0) + n(x.monto);
      conceptos.set(x.concepto_id, c);
    }
    const filas: Celda[][] = [...conceptos.values()].map((c) => [c.categoria, c.concepto, c.veces,
      c.cantidad ? `${formatearCantidad(c.cantidad)} ${c.unidad}`.trim() : "—", ...usadas.map((m) => c.montos[m] ?? null)]);
    return { titulo, nota: "Cada monto en su moneda. Lo que traen los proveedores a crédito (insumos) está en Compras por proveedor.",
      columnas: [{ titulo: "Categoría", tipo: "texto" }, { titulo: "Concepto", tipo: "texto" }, { titulo: "Veces", tipo: "entero" }, { titulo: "Cantidad", tipo: "texto" },
        ...usadas.map((m) => ({ titulo: `Monto ${m}`, tipo: "monto" as const, moneda: m }))],
      filas, totales: ["Total", "", suma(filas, 2), "", ...usadas.map((_, i) => suma(filas, 4 + i))] };
  }
  if (tipo === "produccion") {
    const { data } = await supabase.rpc("produccion_resumen", { p_desde: f.desde, p_hasta: f.hasta });
    const filas: Celda[][] = [...(data ?? [])].reverse().map((x) => [x.fecha, x.codigo, x.nombre, x.unidad, n(x.cantidad)]);
    return { titulo, columnas: [{ titulo: "Fecha", tipo: "fecha" }, { titulo: "Código", tipo: "entero" }, { titulo: "Producto", tipo: "texto" }, { titulo: "Unidad", tipo: "texto" }, { titulo: "Cantidad", tipo: "cantidad" }],
      filas, totales: ["Total", "", "", "", suma(filas, 4)] };
  }
  const { data } = await supabase.rpc("cajas_cestas", { p_desde: f.desde, p_hasta: f.hasta });
  const filas: Celda[][] = (data ?? []).map((x) => [x.tipo === "cajas" ? "Cajas (cliente)" : "Cestas (proveedor)", x.nombre, n(x.salieron), n(x.volvieron), n(x.pendientes)]);
  return { titulo, columnas: [{ titulo: "Tipo", tipo: "texto" }, { titulo: "Cliente / proveedor", tipo: "texto" }, { titulo: "Salieron", tipo: "entero" }, { titulo: "Volvieron", tipo: "entero" }, { titulo: "Pendientes (total)", tipo: "entero" }],
    filas, nota: "Salieron y volvieron: en el periodo. Pendientes: lo que falta devolver desde siempre." };
}
