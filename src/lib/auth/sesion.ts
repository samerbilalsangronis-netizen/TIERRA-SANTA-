import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { evaluarAcceso } from "./acceso";
import { puede, type Permiso, type Rol } from "./roles";
import type { Tables } from "@/lib/supabase/database.types";

export type Perfil = Tables<"profiles">;
export { evaluarAcceso, diasParaVencer, type EstadoAcceso } from "./acceso";

/** Perfil del usuario con sesión (o null). Memoizado por petición. */
export const obtenerPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: perfil } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return perfil ?? null;
});

/**
 * Exige sesión válida (activo, no vencido) y, opcionalmente, un permiso.
 * Si el usuario fue bloqueado o venció mientras navegaba, se cierra su sesión.
 */
export async function exigirPerfil(permiso?: Permiso): Promise<Perfil & { rol: Rol }> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/");
  const acceso = evaluarAcceso(perfil);
  if (!acceso.ok) redirect(`/auth/salir?motivo=${acceso.motivo}`);
  if (perfil.debe_cambiar_clave) redirect("/auth/cambiar-clave");
  if (permiso && !puede(perfil.rol, permiso)) redirect("/sin-permiso");
  return perfil;
}
