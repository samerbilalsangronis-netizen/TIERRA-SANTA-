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

export type Periodicidad = "semanal" | "quincenal" | "mensual";

const sumarDiasISO = (iso: string, dias: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
};
const finDeMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes 1–12

/**
 * Periodo de nómina que contiene una fecha (yyyy-MM-dd), según Configuración → Empresa.
 *  semanal: 7 días desde el día de inicio (0 = domingo … 1 = lunes)
 *  quincenal: 1–15 y 16–fin de mes · mensual: el mes completo
 */
export function periodoDeFecha(fecha: string, periodicidad: Periodicidad, inicioSemana = 1): { desde: string; hasta: string } {
  const [a, m, d] = fecha.split("-").map(Number);
  if (periodicidad === "mensual") {
    return { desde: `${fecha.slice(0, 8)}01`, hasta: `${fecha.slice(0, 8)}${String(finDeMes(a, m)).padStart(2, "0")}` };
  }
  if (periodicidad === "quincenal") {
    return d <= 15
      ? { desde: `${fecha.slice(0, 8)}01`, hasta: `${fecha.slice(0, 8)}15` }
      : { desde: `${fecha.slice(0, 8)}16`, hasta: `${fecha.slice(0, 8)}${String(finDeMes(a, m)).padStart(2, "0")}` };
  }
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  const desde = sumarDiasISO(fecha, -((dia - inicioSemana + 7) % 7));
  return { desde, hasta: sumarDiasISO(desde, 6) };
}

/** Días del calendario mensual (semanas completas que empiezan en inicioSemana); null = relleno. */
export function diasDelMes(mes: string, inicioSemana = 1): (string | null)[] {
  const [a, m] = mes.split("-").map(Number);
  const primero = `${mes}-01`;
  const vacios = (new Date(`${primero}T00:00:00Z`).getUTCDay() - inicioSemana + 7) % 7;
  const dias: (string | null)[] = Array.from({ length: vacios }, () => null);
  for (let d = 1; d <= finDeMes(a, m); d++) dias.push(`${mes}-${String(d).padStart(2, "0")}`);
  while (dias.length % 7) dias.push(null);
  return dias;
}
