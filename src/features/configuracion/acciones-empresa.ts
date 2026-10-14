"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import { esquemaEmpresa, MAX_LOGO_BYTES, TIPOS_LOGO, type DatosEmpresa } from "./esquemas";

export async function guardarEmpresa(datos: DatosEmpresa): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = esquemaEmpresa.safeParse(datos);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("empresa").update(v.data).eq("id", 1);
  if (error) return fallo(mensajeErrorBD(error));

  // Aviso si el número inicial ya no tiene efecto
  const { data: contador } = await supabase.from("contadores").select("valor").eq("clave", "factura").maybeSingle();
  revalidatePath("/", "layout");
  if (contador && contador.valor >= v.data.factura_numero_inicial) {
    return exito(undefined, `Configuración guardada. Nota: ya se emitió la factura nº ${contador.valor}; la próxima será la nº ${contador.valor + 1}.`);
  }
  return exito(undefined, "Configuración guardada.");
}

export async function subirLogo(formulario: FormData): Promise<Resultado<{ logoPath: string }>> {
  await exigirPerfil("configuracion");
  const archivo = formulario.get("logo");
  if (!(archivo instanceof File) || archivo.size === 0) return fallo("Selecciona una imagen.");
  if (!TIPOS_LOGO.includes(archivo.type as (typeof TIPOS_LOGO)[number])) return fallo("Formato no permitido. Usa PNG, JPG, WEBP o SVG.");
  if (archivo.size > MAX_LOGO_BYTES) return fallo("La imagen supera 5 MB.");

  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("empresa").select("logo_path").eq("id", 1).maybeSingle();
  const extension = archivo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const ruta = `logo/logo-${Date.now()}.${extension}`;

  const { error: errorSubida } = await supabase.storage.from("empresa").upload(ruta, archivo, {
    contentType: archivo.type, cacheControl: "31536000", upsert: false,
  });
  if (errorSubida) return fallo(`No se pudo subir el logo: ${errorSubida.message}`);

  const { error } = await supabase.from("empresa").update({ logo_path: ruta }).eq("id", 1);
  if (error) {
    await supabase.storage.from("empresa").remove([ruta]);
    return fallo(mensajeErrorBD(error));
  }
  if (actual?.logo_path) await supabase.storage.from("empresa").remove([actual.logo_path]);
  revalidatePath("/", "layout");
  return exito({ logoPath: ruta }, "Logo actualizado.");
}

export async function quitarLogo(): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("empresa").select("logo_path").eq("id", 1).maybeSingle();
  const { error } = await supabase.from("empresa").update({ logo_path: null }).eq("id", 1);
  if (error) return fallo(mensajeErrorBD(error));
  if (actual?.logo_path) await supabase.storage.from("empresa").remove([actual.logo_path]);
  revalidatePath("/", "layout");
  return exito(undefined, "Se restauró el logo por defecto.");
}
