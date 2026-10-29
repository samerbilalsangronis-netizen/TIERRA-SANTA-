"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import { esquemaConcepto, esquemaGasto, type DatosConcepto, type DatosGasto } from "./esquemas";

function refrescar() {
  revalidatePath("/gastos");
  revalidatePath("/dashboard");
  revalidatePath("/configuracion/catalogos/gastos");
}

/** Registra un gasto nuevo o corrige uno existente (corregir: administración y facturación). */
export async function guardarGasto(entrada: DatosGasto): Promise<Resultado> {
  const v = esquemaGasto.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  await exigirPerfil(id ? "gastos_corregir" : "gastos_registrar");
  const supabase = await crearClienteServidor();
  const fila = { ...d, monto: d.monto as number };
  if (id) {
    const { data: anterior } = await supabase.from("gastos").select("foto_path").eq("id", id).single();
    const { error } = await supabase.from("gastos").update(fila).eq("id", id);
    if (error) return fallo(mensajeErrorBD(error));
    // Si se cambió o quitó la foto, se borra la anterior
    if (anterior?.foto_path && anterior.foto_path !== fila.foto_path) await supabase.storage.from("gastos").remove([anterior.foto_path]);
  } else {
    const { error } = await supabase.from("gastos").insert(fila);
    if (error) return fallo(mensajeErrorBD(error));
  }
  refrescar();
  return exito(undefined, id ? "Gasto corregido." : "Gasto registrado.");
}

export async function eliminarGasto(id: number): Promise<Resultado> {
  await exigirPerfil("gastos_corregir");
  const supabase = await crearClienteServidor();
  const { data: g } = await supabase.from("gastos").select("foto_path").eq("id", id).single();
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  if (g?.foto_path) await supabase.storage.from("gastos").remove([g.foto_path]);
  refrescar();
  return exito(undefined, "Gasto eliminado.");
}

/** Crea o edita un concepto de gasto (crear: quien registra gastos; editar: corregir). */
export async function guardarConcepto(entrada: DatosConcepto): Promise<Resultado<{ id: number }>> {
  const v = esquemaConcepto.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  await exigirPerfil(id ? "gastos_corregir" : "gastos_registrar");
  const supabase = await crearClienteServidor();
  const r = id
    ? await supabase.from("conceptos_gasto").update(d).eq("id", id).select("id").single()
    : await supabase.from("conceptos_gasto").insert(d).select("id").single();
  if (r.error) {
    return r.error.code === "23505"
      ? fallo("Ya existe un concepto con ese nombre.", { nombre: "Ya existe" })
      : fallo(mensajeErrorBD(r.error));
  }
  refrescar();
  return exito({ id: r.data.id }, id ? "Concepto actualizado." : `${d.nombre} agregado.`);
}
