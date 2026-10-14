import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { numeroFactura } from "@/lib/facturas";

export type TipoColumna = "texto" | "fecha" | "cantidad" | "monto" | "entero" | "porcentaje";
export type Columna = { titulo: string; tipo: TipoColumna };
export type Celda = string | number | null;
export type Reporte = { titulo: string; columnas: Columna[]; filas: Celda[][]; totales?: Celda[]; nota?: string; moneda?: string };
export type Filtros = { desde: string; hasta: string; moneda: string };

export const REPORTES = {
  "ventas-producto": { titulo: "Ventas por producto", descripcion: "Bolsas vendidas y monto de cada producto.", moneda: true },
  "ventas-cliente": { titulo: "Ventas por cliente", descripcion: "Cuánto compró cada cliente y cuánto debe de esas facturas.", moneda: true },
  "libro-facturas": { titulo: "Libro de facturas", descripcion: "Todas las facturas del periodo, incluidas las anuladas.", moneda: true },
  "compras-proveedor": { titulo: "Compras por proveedor", descripcion: "Entregas por proveedor y fruta, con kilos y merma.", moneda: false },
  "produccion": { titulo: "Producción diaria", descripcion: "Bolsas producidas por día y producto.", moneda: false },
  "cajas-cestas": { titulo: "Cajas y cestas", descripcion: "Cajas con clientes y cestas con proveedores: movimiento y pendientes.", moneda: false },
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
    const { data } = await supabase.rpc("ventas_por_producto", { p_desde: f.desde, p_hasta: f.hasta, p_moneda: f.moneda });
    const filas: Celda[][] = (data ?? []).map((x) => [x.codigo, x.nombre, x.unidad, n(x.cantidad), n(x.facturas), n(x.monto)]);
    return { titulo, moneda: f.moneda, nota: "Monto sin IVA.",
      columnas: [{ titulo: "Código", tipo: "entero" }, { titulo: "Producto", tipo: "texto" }, { titulo: "Unidad", tipo: "texto" }, { titulo: "Cantidad", tipo: "cantidad" }, { titulo: "Facturas", tipo: "entero" }, { titulo: "Monto", tipo: "monto" }],
      filas, totales: ["", "Total", "", suma(filas, 3), null, suma(filas, 5)] };
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
