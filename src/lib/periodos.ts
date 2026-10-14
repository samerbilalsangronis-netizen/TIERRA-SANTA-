import { sumarDias } from "@/lib/fechas";

export const PERIODOS = [
  ["hoy", "Hoy"], ["semana", "Esta semana"], ["semana_pasada", "Semana pasada"],
  ["mes", "Este mes"], ["mes_pasado", "Mes pasado"], ["rango", "Rango"],
] as const;
export type ClavePeriodo = (typeof PERIODOS)[number][0];
export type Rango = { desde: string; hasta: string };

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const inicioSemana = (iso: string) => sumarDias(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7)); // lunes
const finDeMes = (iso: string) => { const [a, m] = iso.split("-").map(Number); return `${iso.slice(0, 8)}${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`; };
const mesAnterior = (iso: string) => { const [a, m] = iso.split("-").map(Number); const d = new Date(Date.UTC(a, m - 2, 1)); return d.toISOString().slice(0, 10); };

/**
 * Rango del periodo elegido y el periodo anterior para comparar.
 * Semanas de lunes a domingo; "este mes" y "esta semana" llegan hasta hoy y se comparan
 * con los mismos días del periodo anterior (comparación justa a mitad de mes).
 */
export function rangoPeriodo(clave: ClavePeriodo, hoy: string, rango?: Partial<Rango>): { actual: Rango; anterior: Rango } {
  let actual: Rango;
  let anterior: Rango;
  switch (clave) {
    case "hoy":
      actual = { desde: hoy, hasta: hoy }; anterior = { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) }; break;
    case "semana": {
      const d = inicioSemana(hoy);
      actual = { desde: d, hasta: hoy }; anterior = { desde: sumarDias(d, -7), hasta: sumarDias(hoy, -7) }; break;
    }
    case "semana_pasada": {
      const d = sumarDias(inicioSemana(hoy), -7);
      actual = { desde: d, hasta: sumarDias(d, 6) }; anterior = { desde: sumarDias(d, -7), hasta: sumarDias(d, -1) }; break;
    }
    case "mes": {
      const d = `${hoy.slice(0, 8)}01`; const prev = mesAnterior(d);
      const mismoDia = sumarDias(prev, diasEntre(d, hoy));
      actual = { desde: d, hasta: hoy }; anterior = { desde: prev, hasta: mismoDia > finDeMes(prev) ? finDeMes(prev) : mismoDia }; break;
    }
    case "mes_pasado": {
      const d = mesAnterior(`${hoy.slice(0, 8)}01`); const prev = mesAnterior(d);
      actual = { desde: d, hasta: finDeMes(d) }; anterior = { desde: prev, hasta: finDeMes(prev) }; break;
    }
    default: {
      const desde = rango?.desde || sumarDias(hoy, -29);
      const hasta = rango?.hasta && rango.hasta >= desde ? rango.hasta : hoy;
      const n = diasEntre(desde, hasta) + 1;
      actual = { desde, hasta }; anterior = { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) };
    }
  }
  return { actual, anterior };
}

/** Variación porcentual (null si no hay base para comparar). */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}
