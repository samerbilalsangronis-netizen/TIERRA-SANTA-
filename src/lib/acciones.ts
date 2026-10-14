import type { z } from "zod";

/** Resultado estándar de una Server Action. */
export type Resultado<T = undefined> =
  | { ok: true; datos: T; mensaje?: string }
  | { ok: false; error: string; campos?: Record<string, string> };

export function exito<T>(datos: T, mensaje?: string): Resultado<T> {
  return { ok: true, datos, mensaje };
}

export function fallo(error: string, campos?: Record<string, string>): { ok: false; error: string; campos?: Record<string, string> } {
  return { ok: false, error, campos };
}

/** Convierte errores de Zod en { campo: mensaje }. */
export function erroresZod(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const clave = issue.path.join(".");
    if (!campos[clave]) campos[clave] = issue.message;
  }
  return campos;
}

/** Traduce errores de Postgres/PostgREST a mensajes en español para el usuario. */
export function mensajeErrorBD(error: { message?: string; code?: string; details?: string } | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado.";
  const { code, message = "" } = error;
  if (code === "42501") return message.includes("row-level security") ? "No tienes permiso para realizar esta operación." : message;
  if (code === "23505") return "Ya existe un registro con ese valor (duplicado).";
  if (code === "23503") return "No se puede completar: el registro está relacionado con otros datos.";
  if (code === "23514") return "Algún dato no cumple las reglas de validación.";
  if (code === "PGRST116") return "Registro no encontrado.";
  // Excepciones propias (raise exception) ya vienen en español
  if (code === "P0001") return message;
  return message || "Ocurrió un error inesperado.";
}
