"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

let cliente: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Cliente de Supabase para componentes de cliente (subida de archivos, etc.). */
export function crearClienteNavegador() {
  cliente ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cliente;
}
