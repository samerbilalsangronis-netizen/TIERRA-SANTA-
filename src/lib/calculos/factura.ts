import { Decimal, dec, r2, type Monto } from "@/lib/dinero";

export type LineaCalculo = { cantidad: Monto; precioUnitario: Monto; aplicaIva: boolean };
export type TotalesFactura = {
  lineas: Decimal[]; baseImponible: Decimal; exento: Decimal; subtotal: Decimal; iva: Decimal; total: Decimal;
};

/**
 * Totales de factura (idénticos a public.factura_guardar_lineas):
 *  total_linea = round(cantidad × precio, 2)
 *  base_imponible = Σ líneas con IVA · exento = Σ líneas sin IVA
 *  iva = round(base_imponible × iva_pct / 100, 2) · total = base + exento + iva
 */
export function calcularTotales(lineas: LineaCalculo[], ivaPct: Monto): TotalesFactura {
  const totales = lineas.map((l) => r2(dec(l.cantidad).times(dec(l.precioUnitario))));
  let base = new Decimal(0);
  let exento = new Decimal(0);
  lineas.forEach((l, i) => {
    if (l.aplicaIva) base = base.plus(totales[i]);
    else exento = exento.plus(totales[i]);
  });
  const iva = r2(base.times(dec(ivaPct)).div(100));
  return { lineas: totales, baseImponible: base, exento, subtotal: base.plus(exento), iva, total: base.plus(exento).plus(iva) };
}

export type FacturaPendiente = { id: number; fecha: string; saldo: Monto };
export type Reparto = { facturaId: number; monto: Decimal; completa: boolean };

/**
 * Reparte un pago de la factura más vieja a la más nueva; la última queda abonada si no alcanza.
 * Devuelve el reparto y lo que sobra (queda como saldo a favor).
 */
export function repartirPago(monto: Monto, facturas: FacturaPendiente[]): { reparto: Reparto[]; sobrante: Decimal } {
  let resto = dec(monto);
  const ordenadas = [...facturas].sort((a, b) => (a.fecha === b.fecha ? a.id - b.id : a.fecha < b.fecha ? -1 : 1));
  const reparto: Reparto[] = [];
  for (const f of ordenadas) {
    if (resto.lte(0)) break;
    const saldo = dec(f.saldo);
    if (saldo.lte(0)) continue;
    const toma = Decimal.min(resto, saldo);
    reparto.push({ facturaId: f.id, monto: toma, completa: toma.eq(saldo) });
    resto = resto.minus(toma);
  }
  return { reparto, sobrante: resto };
}

/** Estado de pago de una factura (mismo criterio que la columna generada estado_pago). */
export function estadoPago(estado: "borrador" | "emitida" | "anulada", total: Monto, pagado: Monto) {
  if (estado === "anulada") return "anulada";
  if (estado === "borrador") return "borrador";
  const t = dec(total), p = dec(pagado);
  if (p.lte(0) && t.gt(0)) return "pendiente";
  if (p.lt(t)) return "abonada";
  return "pagada";
}
