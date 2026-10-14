import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { periodoDeFecha, type Periodicidad } from "@/lib/calculos/nomina";
import { hoyISO } from "@/lib/fechas";

export type EmpleadoLista = {
  id: number; nombre: string; cedula: string | null; tipo: "fijo" | "destajo"; tarifa_dia: number; cargo: string | null;
  activo: boolean; saldo_neto: number; ultima_jornada: string | null;
};
export type Tarea = { id: number; emoji: string | null; nombre: string; valor: number; unidad: string; activa: boolean };
export type JornadaDia = {
  id: number; fecha: string; estado: "asistio" | "media" | "produccion" | "no"; justificada: boolean;
  pago_dia: number; pago_adicional: number; total_tareas: number; ganado: number; tarifa_aplicada: number; nota: string | null;
  jornada_tareas: { tarea_id: number; cantidad: number; valor_unitario: number; subtotal: number }[];
};

export async function configNomina() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("empresa").select("nomina_periodicidad, nomina_inicio_semana").eq("id", 1).single();
  const periodicidad = (data?.nomina_periodicidad ?? "semanal") as Periodicidad;
  const inicioSemana = Number(data?.nomina_inicio_semana ?? 1);
  const hoy = hoyISO();
  return { periodicidad, inicioSemana, hoy, actual: periodoDeFecha(hoy, periodicidad, inicioSemana) };
}

export async function cargarEmpleados(): Promise<EmpleadoLista[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("v_resumen_empleados")
    .select("id, nombre, cedula, tipo, tarifa_dia, cargo, activo, saldo_neto, ultima_jornada").order("nombre");
  return (data ?? []).map((e) => ({
    id: e.id!, nombre: e.nombre!, cedula: e.cedula, tipo: e.tipo as "fijo" | "destajo", tarifa_dia: Number(e.tarifa_dia ?? 0),
    cargo: e.cargo, activo: Boolean(e.activo), saldo_neto: Number(e.saldo_neto ?? 0), ultima_jornada: e.ultima_jornada,
  }));
}

export async function cargarTareas(): Promise<Tarea[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("tareas_nomina").select("id, emoji, nombre, valor, unidad, activa").order("orden").order("nombre");
  return (data ?? []).map((t) => ({ ...t, valor: Number(t.valor) }));
}

const COLUMNAS_JORNADA = "id, fecha, estado, justificada, pago_dia, pago_adicional, total_tareas, ganado, tarifa_aplicada, nota, jornada_tareas(tarea_id, cantidad, valor_unitario, subtotal)";

export async function cargarJornadas(empleadoId: number, desde: string, hasta: string): Promise<JornadaDia[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("jornadas").select(COLUMNAS_JORNADA)
    .eq("empleado_id", empleadoId).gte("fecha", desde).lte("fecha", hasta).order("fecha");
  return (data ?? []).map((j) => ({
    ...j, pago_dia: Number(j.pago_dia), pago_adicional: Number(j.pago_adicional), total_tareas: Number(j.total_tareas),
    ganado: Number(j.ganado ?? 0), tarifa_aplicada: Number(j.tarifa_aplicada),
    jornada_tareas: j.jornada_tareas.map((t) => ({ ...t, cantidad: Number(t.cantidad), valor_unitario: Number(t.valor_unitario), subtotal: Number(t.subtotal ?? 0) })),
  }));
}

/** Periodos cerrados que tocan un rango (para bloquear días en el calendario). */
export async function periodosCerrados(desde: string, hasta: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("periodos_nomina").select("desde, hasta").eq("estado", "cerrado").lte("desde", hasta).gte("hasta", desde);
  return data ?? [];
}
