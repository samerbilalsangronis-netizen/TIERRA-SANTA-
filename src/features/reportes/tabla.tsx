import { formatearCantidad, formatearMonto, formatearNumero } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { Celda, Columna } from "./definiciones";

export function formatearCelda(v: Celda, c: Columna, moneda?: string): string {
  if (v === null || v === "") return v === "" ? "" : "—";
  if (typeof v === "string") return c.tipo === "fecha" ? formatearFecha(v) : v;
  switch (c.tipo) {
    case "monto": return formatearMonto(v, c.moneda ?? moneda ?? "COP", { sinCodigo: true });
    case "cantidad": return formatearCantidad(v);
    case "porcentaje": return `${formatearNumero(v, 1)} %`;
    default: return String(v);
  }
}
const derecha = (c: Columna) => ["cantidad", "monto", "entero", "porcentaje"].includes(c.tipo);

/** Tabla de reporte: se desplaza de lado en el teléfono y se imprime completa. */
export function TablaReporte({ columnas, filas, totales, moneda }: { columnas: Columna[]; filas: Celda[][]; totales?: Celda[]; moneda?: string }) {
  // Va dentro de la Hoja blanca (igual en pantalla y en papel)
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b-2 border-neutral-800 text-[11px] uppercase tracking-wide text-neutral-600">
          <tr>{columnas.map((c) => <th key={c.titulo} className={cn("whitespace-nowrap px-2 py-1.5 text-left", derecha(c) && "text-right")}>{c.titulo}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="even:bg-neutral-100">
              {columnas.map((c, j) => <td key={j} className={cn("px-2 py-1.5", derecha(c) && "tabular whitespace-nowrap text-right", c.tipo === "fecha" && "whitespace-nowrap")}>{formatearCelda(f[j], c, moneda)}</td>)}
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={columnas.length} className="p-6 text-center text-neutral-500">Sin datos en este periodo.</td></tr>}
        </tbody>
        {totales && filas.length > 0 && (
          <tfoot className="border-t-2 border-neutral-800 font-semibold">
            <tr>{columnas.map((c, j) => <td key={j} className={cn("px-2 py-1.5", derecha(c) && "tabular whitespace-nowrap text-right")}>{formatearCelda(totales[j] ?? "", c, moneda)}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
