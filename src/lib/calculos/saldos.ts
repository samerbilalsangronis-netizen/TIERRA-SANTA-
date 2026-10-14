import { Decimal, dec, type Monto } from "@/lib/dinero";

export type SaldosPorMoneda = Record<string, Decimal>;

/** Etiqueta "moneda" del panel de clientes: USD, COP, USD/COP o "-" según los saldos positivos. */
export function etiquetaMoneda(saldos: Record<string, Monto>): string {
  const positivas = ["USD", "COP", "VES"].filter((m) => dec(saldos[m]).gt(0));
  return positivas.length ? positivas.join("/") : "-";
}

/** CRÍTICO si algún saldo > 0, AL DÍA si todos ≤ 0. */
export function estadoCliente(saldos: Record<string, Monto>): "CRÍTICO" | "AL DÍA" {
  return Object.values(saldos).some((s) => dec(s).gt(0)) ? "CRÍTICO" : "AL DÍA";
}

/** Saldo del proveedor por moneda = Σ total entregas − Σ abonos. */
export function saldoProveedor(entregas: { moneda: string; total: Monto }[], abonos: { moneda: string; monto: Monto }[]): SaldosPorMoneda {
  const r: SaldosPorMoneda = {};
  for (const e of entregas) r[e.moneda] = (r[e.moneda] ?? new Decimal(0)).plus(dec(e.total));
  for (const a of abonos) r[a.moneda] = (r[a.moneda] ?? new Decimal(0)).minus(dec(a.monto));
  return r;
}

/** Cajas/cestas pendientes = Σ retiradas (entregadas) − Σ devueltas. */
export function pendientes(movs: { sale: number; vuelve: number }[]): number {
  return movs.reduce((acc, m) => acc + m.sale - m.vuelve, 0);
}
