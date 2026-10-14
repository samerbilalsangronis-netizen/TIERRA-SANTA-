import { ZONA_HORARIA } from "@/lib/env";

const fmtISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit",
});
const fmtFecha = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric",
});
const fmtFechaHora = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});
const fmtLarga = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA, weekday: "long", day: "numeric", month: "long", year: "numeric",
});

/** Fecha de hoy en Caracas como "yyyy-MM-dd". */
export function hoyISO(ahora: Date = new Date()): string {
  return fmtISO.format(ahora);
}

/** "2026-10-14" → "14/10/2026". También acepta timestamps ISO. */
export function formatearFecha(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split("-");
    return `${d}/${m}/${a}`;
  }
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  return Number.isNaN(fecha.getTime()) ? "—" : fmtFecha.format(fecha);
}

/** Fecha y hora en Caracas: "14/10/2026, 03:15 p. m." */
export function formatearFechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  return Number.isNaN(fecha.getTime()) ? "—" : fmtFechaHora.format(fecha);
}

/** "martes, 14 de octubre de 2026" */
export function formatearFechaLarga(valor: Date = new Date()): string {
  return fmtLarga.format(valor);
}

/** "14/10/2026" → "2026-10-14" (null si no es válida). */
export function parsearFecha(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  const iso = `${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return t.getUTCDate() === Number(d) && t.getUTCMonth() + 1 === Number(mes) ? iso : null;
}

/** Suma días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}
