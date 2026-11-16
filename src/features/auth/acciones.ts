"use server";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresZod, exito, fallo, type Resultado } from "@/lib/acciones";
import { evaluarAcceso } from "@/lib/auth/acceso";
import { esquemaCambioClave, esquemaLogin, type DatosCambioClave, type DatosLogin } from "./esquemas";

const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos.";
const MENSAJES_ACCESO = {
  bloqueado: "Tu usuario está BLOQUEADO. Comunícate con el administrador.",
  inactivo: "Tu usuario está INACTIVO. Comunícate con el administrador.",
} as const;

export async function iniciarSesion(datos: DatosLogin): Promise<Resultado<{ destino: string }>> {
  const v = esquemaLogin.safeParse(datos);
  if (!v.success) return fallo("Revisa los datos.", erroresZod(v.error));

  const supabase = await crearClienteServidor();
  const { data: sesion, error } = await supabase.auth.signInWithPassword({ email: v.data.correo, password: v.data.clave });
  if (error || !sesion.user) {
    return fallo(error?.code === "email_not_confirmed" ? "El correo de este usuario no está confirmado." : MENSAJE_CREDENCIALES);
  }

  const { data: perfil } = await supabase.from("profiles").select("*").eq("id", sesion.user.id).maybeSingle();
  if (!perfil) {
    await supabase.auth.signOut();
    return fallo("Tu usuario no tiene perfil asignado. Comunícate con el administrador.");
  }
  const acceso = evaluarAcceso(perfil);
  if (!acceso.ok) {
    await supabase.auth.signOut();
    return fallo(MENSAJES_ACCESO[acceso.motivo]);
  }

  await supabase.rpc("registrar_acceso");
  const siguiente = v.data.siguiente?.startsWith("/") && !v.data.siguiente.startsWith("//") ? v.data.siguiente : "/dashboard";
  return exito({ destino: perfil.debe_cambiar_clave ? "/auth/cambiar-clave" : siguiente });
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/");
}

export async function cambiarClavePropia(datos: DatosCambioClave): Promise<Resultado> {
  const v = esquemaCambioClave.safeParse(datos);
  if (!v.success) return fallo("Revisa los datos.", erroresZod(v.error));
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return fallo("Tu sesión expiró. Vuelve a iniciar sesión.");
  const { error } = await supabase.auth.updateUser({ password: v.data.clave });
  if (error) {
    return fallo(error.code === "same_password" ? "La nueva contraseña debe ser distinta a la anterior." : "No se pudo cambiar la contraseña.");
  }
  await supabase.from("profiles").update({ debe_cambiar_clave: false }).eq("id", id);
  return exito(undefined, "Contraseña actualizada.");
}
