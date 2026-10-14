"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { esquemaAbono, esquemaEmpleado, esquemaJornada, esquemaPeriodo, type DatosAbono, type DatosEmpleado, type DatosJornada } from "./esquemas";

const refrescar = () => revalidatePath("/nomina", "layout");

export async function guardarEmpleado(entrada: DatosEmpleado): Promise<Resultado<{ id: number }>> {
  await exigirPerfil("nomina");
  const v = esquemaEmpleado.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  const { data, error } = id
    ? await supabase.from("empleados").update(d).eq("id", id).select("id").single()
    : await supabase.from("empleados").insert(d).select("id").single();
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito({ id: data.id }, id ? "Empleado actualizado." : `${d.nombre} agregado.`);
}

export async function eliminarEmpleado(id: number): Promise<Resultado> {
  await exigirPerfil("nomina");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("empleados").delete().eq("id", id);
  if (error) {
    return error.code === "23503" ? fallo("El empleado tiene jornadas o abonos. Desactívalo en su lugar (Editar → Activo).") : fallo(mensajeErrorBD(error));
  }
  refrescar();
  return exito(undefined, "Empleado eliminado.");
}

export async function guardarJornada(entrada: DatosJornada): Promise<Resultado> {
  await exigirPerfil("nomina");
  const v = esquemaJornada.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_jornada", { p: v.data });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, `Jornada del ${formatearFecha(v.data.fecha)} guardada.`);
}

export async function eliminarJornada(empleadoId: number, fecha: string): Promise<Resultado> {
  await exigirPerfil("nomina");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("jornadas").delete().eq("empleado_id", empleadoId).eq("fecha", fecha);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, "Jornada borrada.");
}

export async function guardarAbono(entrada: DatosAbono): Promise<Resultado> {
  await exigirPerfil("nomina");
  const v = esquemaAbono.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  const fila = { ...d, monto: d.monto! };
  const { error } = id
    ? await supabase.from("abonos_empleados").update(fila).eq("id", id).eq("tipo", "adelanto")
    : await supabase.from("abonos_empleados").insert(fila);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, id ? "Abono actualizado." : `Abono de ${formatearMonto(fila.monto, "COP")} registrado.`);
}

export async function eliminarAbono(id: number): Promise<Resultado> {
  await exigirPerfil("nomina");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("abonos_empleados").delete().eq("id", id).eq("tipo", "adelanto");
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, "Abono eliminado.");
}

export async function crearPeriodo(desde: string, hasta: string): Promise<Resultado<{ id: number }>> {
  await exigirPerfil("nomina");
  const v = esquemaPeriodo.safeParse({ desde, hasta });
  if (!v.success) return fallo(v.error.issues[0].message);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("periodos_nomina").insert(v.data).select("id").single();
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito({ id: data.id }, `Periodo ${formatearFecha(desde)} – ${formatearFecha(hasta)} creado.`);
}

export async function cerrarPeriodo(id: number, liquidar: boolean, entregadoPor: string): Promise<Resultado> {
  await exigirPerfil("nomina");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("cerrar_periodo_nomina", { p_periodo_id: id, p_liquidar: liquidar, p_entregado_por: entregadoPor || undefined });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, liquidar ? "Periodo cerrado y pagado: los saldos quedaron en 0." : "Periodo cerrado.");
}

export async function reabrirPeriodo(id: number, motivo: string): Promise<Resultado> {
  await exigirPerfil("nomina");
  if (motivo.trim().length < 3) return fallo("Escribe el motivo.");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("reabrir_periodo_nomina", { p_periodo_id: id, p_motivo: motivo.trim() });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, "Periodo reabierto.");
}

export async function eliminarPeriodo(id: number): Promise<Resultado> {
  await exigirPerfil("nomina");
  const supabase = await crearClienteServidor();
  const { error, count } = await supabase.from("periodos_nomina").delete({ count: "exact" }).eq("id", id).eq("estado", "abierto");
  if (error) return fallo(mensajeErrorBD(error));
  if (!count) return fallo("Solo se puede eliminar un periodo abierto.");
  refrescar();
  return exito(undefined, "Periodo eliminado.");
}
