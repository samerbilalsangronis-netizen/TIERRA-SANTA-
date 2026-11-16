import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente con la clave de servicio (salta RLS). SOLO en el servidor y solo para:
 * administración de usuarios de Auth y la búsqueda del correo interno al iniciar sesión.
 * Nunca exponer al navegador.
 */
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
  }
  return createClient<Database>(SUPABASE_URL, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
