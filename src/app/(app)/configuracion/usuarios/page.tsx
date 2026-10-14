import type { Metadata } from "next";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelUsuarios } from "@/features/usuarios/panel-usuarios";

export const metadata: Metadata = { title: "Usuarios" };

export default async function PaginaUsuarios() {
  const yo = await exigirPerfil("usuarios");
  const supabase = await crearClienteServidor();
  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id, email, nombre, rol, estado, ultimo_acceso, debe_cambiar_clave")
    .order("nombre");
  return <PanelUsuarios usuarios={usuarios ?? []} yoId={yo.id} />;
}
