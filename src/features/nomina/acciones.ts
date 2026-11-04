"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import {
  esquemaAbono, esquemaEmpleado, esquemaJornada, esquemaPagoVarios, esquemaPeriodo,
  type DatosAbono, type DatosEmpleado, type DatosJornada, type DatosPagoVarios,
} from "./esquemas";

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
  // Los pagos que hizo el cierre de un periodo (sistema anterior) no se tocan desde aquí
  const { error } = id
    ? await supabase.from("abonos_empleados").update(fila).eq("id", id).is("periodo_id", null)
    : await supabase.from("abonos_empleados").insert(fila);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  const que = fila.tipo === "liquidacion" ? "Pago" : "Adelanto";
  return exito(undefined, id ? `${que} actualizado.` : `${que} de ${formatearMonto(fila.monto, "COP")} registrado.`);
}

/** Registra el pago de varios empleados el mismo día (cada uno queda como su "último pago"). */
export async function pagarVarios(entrada: DatosPagoVarios): Promise<Resultado> {
  await exigirPerfil("nomina");
  const v = esquemaPagoVarios.safeParse(entrada);
  if (!v.success) return fallo(v.error.issues[0]?.message ?? "Revisa los montos.");
  const { fecha, entregado_por, pagos } = v.data;
  const supabase = await crearClienteServidor();
  const filas = pagos.map((p) => ({ empleado_id: p.empleado_id, monto: p.monto!, fecha, entregado_por, tipo: "liquidacion" as const }));
  const { error } = await supabase.from("abonos_empleados").insert(filas);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  const total = filas.reduce((a, f) => a + f.monto, 0);
  return exito(undefined, `${filas.length} pago${filas.length === 1 ? "" : "s"} registrado${filas.length === 1 ? "" : "s"} · ${formatearMonto(total, "COP")}.`);
}

export async function eliminarAbono(id: number): Promise<Resultado> {
  await exigirPerfil("nomina");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("abonos_empleados").delete().eq("id", id).is("periodo_id", null);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, "Eliminado.");
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
