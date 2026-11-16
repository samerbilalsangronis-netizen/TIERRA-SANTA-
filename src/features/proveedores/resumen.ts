import { sumar } from "@/lib/dinero";
export type TotalEntregas = { total: number; kg: number; merma: number; neto: number; cestas: number; n: number };
export function resumirEntregas(entregas: { moneda: string; total: number; kg_total: number; merma: number; peso_neto: number; cestas: number }[]): [string, TotalEntregas][] {
  const m = new Map<string, TotalEntregas>();
  for (const e of entregas) {
    const t = m.get(e.moneda) ?? { total: 0, kg: 0, merma: 0, neto: 0, cestas: 0, n: 0 };
    m.set(e.moneda, {
      total: sumar([t.total, e.total]).toNumber(), kg: sumar([t.kg, e.kg_total]).toNumber(), merma: sumar([t.merma, e.merma]).toNumber(),
      neto: sumar([t.neto, e.peso_neto]).toNumber(), cestas: sumar([t.cestas, e.cestas]).toNumber(), n: t.n + 1,
    });
  }
  return [...m.entries()];
}
export function resumirAbonos(abonos: { moneda: string; monto: number }[]): [string, number][] {
  const m = new Map<string, number>();
  for (const a of abonos) m.set(a.moneda, sumar([m.get(a.moneda) ?? 0, a.monto]).toNumber());
  return [...m.entries()];
}
