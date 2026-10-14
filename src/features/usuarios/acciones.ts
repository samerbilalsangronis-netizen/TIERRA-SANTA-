"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import {
  esquemaEditarUsuario, esquemaNuevoUsuario, esquemaRestablecer,
  type DatosEditarUsuario, type DatosNuevoUsuario, type DatosRestablecer,
} from "./esquemas";

function sinClaveServicio() {
  return !process.env.SUPABASE_SERVICE_ROLE_KEY
    ? fallo("Falta la variable SUPABASE_SERVICE_ROLE_KEY en Vercel: sin ella no se pueden crear cuentas ni cambiar contraseñas.")
    : null;
}

async function registrar(adminId: string, adminCorreo: string, accion: string, registroId: string, despues?: object, nota?: string) {
  await crearClienteAdmin().from("audit_log").insert({
    usuario_id: adminId, usuario: adminCorreo, accion, tabla: "usuarios", registro_id: registroId,
    despues: (despues ?? null) as never, nota: nota ?? null,
  });
}

export async function crearUsuario(datos: DatosNuevoUsuario): Promise<Resultado> {
  const yo = await exigirPerfil("usuarios");
  const sinClave = sinClaveServicio();
  if (sinClave) return sinClave;
  const v = esquemaNuevoUsuario.safeParse(datos);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const d = v.data;

  const admin = crearClienteAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: d.correo,
    password: d.clave,
    email_confirm: true,
    user_metadata: { nombre: d.nombre },
  });
  if (error || !data.user) {
    const msg = error?.code === "email_exists" ? "Ya existe una cuenta con ese correo." : `No se pudo crear la cuenta: ${error?.message ?? ""}`;
    return fallo(msg, error?.code === "email_exists" ? { correo: "Ya existe" } : undefined);
  }
  // El trigger crea el perfil INACTIVO (así un registro público no tiene acceso);
  // aquí, con la clave de servicio, se le asigna el rol y se activa.
  const { error: errorPerfil } = await admin.from("profiles").update({
    nombre: d.nombre, rol: d.rol, estado: "ACTIVO", debe_cambiar_clave: d.debe_cambiar_clave,
  }).eq("id", data.user.id);
  if (errorPerfil) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fallo(mensajeErrorBD(errorPerfil));
  }
  await registrar(yo.id, yo.email, "CREAR_USUARIO", data.user.id, { correo: d.correo, nombre: d.nombre, rol: d.rol });
  revalidatePath("/configuracion/usuarios");
  return exito(undefined, `Usuario ${d.correo} creado.`);
}

export async function editarUsuario(datos: DatosEditarUsuario): Promise<Resultado> {
  const yo = await exigirPerfil("usuarios");
  const v = esquemaEditarUsuario.safeParse(datos);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const d = v.data;
  if (d.id === yo.id && (d.rol !== "admin" || d.estado !== "ACTIVO")) {
    return fallo("No puedes quitarte el rol de administrador ni bloquear tu propio usuario.");
  }

  const supabase = await crearClienteServidor();
  const { data: anterior } = await supabase.from("profiles").select("email").eq("id", d.id).maybeSingle();
  if (!anterior) return fallo("Usuario no encontrado.");

  // El correo vive en Auth; un trigger lo copia al perfil
  if (anterior.email !== d.correo) {
    const sinClave = sinClaveServicio();
    if (sinClave) return sinClave;
    const { error } = await crearClienteAdmin().auth.admin.updateUserById(d.id, { email: d.correo, email_confirm: true });
    if (error) return fallo(error.code === "email_exists" ? "Ya existe una cuenta con ese correo." : `No se pudo cambiar el correo: ${error.message}`);
  }

  // Con la sesión del admin: la bitácora registra quién hizo el cambio
  const { error } = await supabase.from("profiles").update({ nombre: d.nombre, rol: d.rol, estado: d.estado }).eq("id", d.id);
  if (error) return fallo(mensajeErrorBD(error));
  revalidatePath("/configuracion/usuarios");
  return exito(undefined, "Usuario actualizado.");
}

export async function cambiarEstadoUsuario(id: string, estado: "ACTIVO" | "BLOQUEADO" | "INACTIVO"): Promise<Resultado> {
  const yo = await exigirPerfil("usuarios");
  if (id === yo.id) return fallo("No puedes cambiar el estado de tu propio usuario.");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("profiles").update({ estado }).eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  revalidatePath("/configuracion/usuarios");
  return exito(undefined, estado === "ACTIVO" ? "Usuario activado." : `Usuario ${estado.toLowerCase()}.`);
}

export async function restablecerClave(datos: DatosRestablecer): Promise<Resultado> {
  const yo = await exigirPerfil("usuarios");
  const sinClave = sinClaveServicio();
  if (sinClave) return sinClave;
  const v = esquemaRestablecer.safeParse(datos);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));

  const { error } = await crearClienteAdmin().auth.admin.updateUserById(v.data.id, { password: v.data.clave });
  if (error) return fallo(`No se pudo restablecer: ${error.message}`);
  const supabase = await crearClienteServidor();
  await supabase.from("profiles").update({ debe_cambiar_clave: v.data.debe_cambiar_clave }).eq("id", v.data.id);
  await registrar(yo.id, yo.email, "RESTABLECER_CLAVE", v.data.id, undefined,
    v.data.debe_cambiar_clave ? "Se exigirá cambio en el próximo inicio" : undefined);
  return exito(undefined, "Contraseña restablecida.");
}
