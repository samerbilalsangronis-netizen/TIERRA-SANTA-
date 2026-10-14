import { Decimal, dec, r2, type Monto } from "@/lib/dinero";

export type TipoEmpleado = "fijo" | "destajo";
export type EstadoJornada = "asistio" | "media" | "produccion" | "no";

/**
 * Lo ganado en una jornada (idéntico a los triggers de public.jornadas):
 *  Fijo: asistió = tarifa del día · media jornada = mitad · no asistió/producción = 0
 *  Destajo: 0 por día
 *  + pago adicional por día + Σ (cantidad × valor de la tarea)
 */
export function calcularJornada(p: {
  tipo: TipoEmpleado; estado: EstadoJornada; tarifaDia: Monto; pagoAdicional?: Monto;
  tareas?: { cantidad: Monto; valor: Monto }[];
}) {
  const tarifa = dec(p.tarifaDia);
  const pagoDia =
    p.tipo === "fijo" ? (p.estado === "asistio" ? tarifa : p.estado === "media" ? r2(tarifa.div(2)) : new Decimal(0)) : new Decimal(0);
  const totalTareas = (p.tareas ?? []).reduce((acc, t) => acc.plus(r2(dec(t.cantidad).times(dec(t.valor)))), new Decimal(0));
  const adicional = dec(p.pagoAdicional);
  return { pagoDia, totalTareas, pagoAdicional: adicional, ganado: pagoDia.plus(adicional).plus(totalTareas) };
}

/** Saldo neto por empleado = ganado − abonos. */
export function saldoNeto(ganado: Monto[], abonos: Monto[]) {
  return ganado.reduce<Decimal>((a, g) => a.plus(dec(g)), new Decimal(0)).minus(abonos.reduce<Decimal>((a, b) => a.plus(dec(b)), new Decimal(0)));
}
