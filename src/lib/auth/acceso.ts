import type { Tables } from "@/lib/supabase/database.types";

export type EstadoAcceso = { ok: true } | { ok: false; motivo: "bloqueado" | "inactivo" };

/** Evalúa si un perfil puede entrar (misma regla que rol_actual() en la BD). */
export function evaluarAcceso(perfil: Pick<Tables<"profiles">, "estado">): EstadoAcceso {
  if (perfil.estado === "BLOQUEADO") return { ok: false, motivo: "bloqueado" };
  if (perfil.estado === "INACTIVO") return { ok: false, motivo: "inactivo" };
  return { ok: true };
}
