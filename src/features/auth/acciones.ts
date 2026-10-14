"use server";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { erroresZod, exito, fallo, type Resultado } from "@/lib/acciones";
import { correoInterno, normalizarUsuario } from "@/lib/auth/roles";
import { diasParaVencer, evaluarAcceso } from "@/lib/auth/acceso";
import { formatearFecha } from "@/lib/fechas";
import { esquemaCambioClave, esquemaLogin, type DatosCambioClave, type DatosLogin } from "./esquemas";

const MENSAJE_CREDENCIALES = "Usuario o contraseña incorrectos.";

const MENSAJES_ACCESO = {
  bloqueado: "Tu usuario está BLOQUEADO. Comunícate con el administrador.",
  inactivo: "Tu usuario está INACTIVO. Comunícate con el administrador.",
} as const;

/** Busca el correo de Auth asociado a un nombre de usuario. */
async function resolverCorreo(usuario: string): Promise<string | null> {
  const u = normalizarUsuario(usuario);
  if (u.includes("@")) return u;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return correoInterno(u);
  const admin = crearClienteAdmin();
  const { data: perfil } = await admin.from("profiles").select("id").eq("usuario", u).maybeSingle();
  if (!perfil) return null;
  const { data } = await admin.auth.admin.getUserById(perfil.id);
  return data.user?.email ?? correoInterno(u);
}

async function registrarEvento(usuarioId: string, usuario: string, accion: string, nota?: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  await crearClienteAdmin().from("audit_log").insert({
    usuario_id: usuarioId, usuario, accion, tabla: "auth", registro_id: usuarioId, nota: nota ?? null,
  });
}

export async function iniciarSesion(
  datos: DatosLogin,
): Promise<Resultado<{ destino: string; diasRestantes: number | null; debeCambiarClave: boolean }>> {
  const v = esquemaLogin.safeParse(datos);
  if (!v.success) return fallo("Revisa los datos.", erroresZod(v.error));

  const correo = await resolverCorreo(v.data.usuario);
  if (!correo) return fallo(MENSAJE_CREDENCIALES);

  const supabase = await crearClienteServidor();
  const { data: sesion, error } = await supabase.auth.signInWithPassword({ email: correo, password: v.data.clave });
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
    if (acceso.motivo === "vencido" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Igual que el sistema anterior: al vencer, el usuario queda BLOQUEADO
      await crearClienteAdmin().from("profiles").update({ estado: "BLOQUEADO" }).eq("id", perfil.id);
    }
    await registrarEvento(perfil.id, perfil.usuario, "LOGIN_RECHAZADO", acceso.motivo);
    await supabase.auth.signOut();
    if (acceso.motivo === "vencido") return fallo(`Tu suscripción venció el ${formatearFecha(acceso.venceEl)}.`);
    return fallo(MENSAJES_ACCESO[acceso.motivo]);
  }

  await supabase.rpc("registrar_acceso");
  await registrarEvento(perfil.id, perfil.usuario, "LOGIN");

  const siguiente = v.data.siguiente?.startsWith("/") && !v.data.siguiente.startsWith("//") ? v.data.siguiente : "/dashboard";
  return exito({
    destino: perfil.debe_cambiar_clave ? "/auth/cambiar-clave" : siguiente,
    diasRestantes: diasParaVencer(perfil.vence_el),
    debeCambiarClave: perfil.debe_cambiar_clave,
  });
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
