import { hoyISO } from "@/lib/fechas";
import type { Tables } from "@/lib/supabase/database.types";

export type EstadoAcceso =
  | { ok: true }
  | { ok: false; motivo: "bloqueado" | "inactivo" | "vencido"; venceEl?: string | null };

/** Evalúa si un perfil puede entrar (misma regla que rol_actual() en la BD). */
export function evaluarAcceso(perfil: Pick<Tables<"profiles">, "estado" | "vence_el">, hoy = hoyISO()): EstadoAcceso {
  if (perfil.estado === "BLOQUEADO") return { ok: false, motivo: "bloqueado" };
  if (perfil.estado === "INACTIVO") return { ok: false, motivo: "inactivo" };
  if (perfil.vence_el && perfil.vence_el < hoy) return { ok: false, motivo: "vencido", venceEl: perfil.vence_el };
  return { ok: true };
}

/** Días que faltan para el vencimiento (null si no vence). */
export function diasParaVencer(venceEl: string | null, hoy = hoyISO()): number | null {
  if (!venceEl) return null;
  const ms = Date.parse(`${venceEl}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

