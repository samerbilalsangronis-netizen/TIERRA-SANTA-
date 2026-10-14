import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

export type FilaPeriodo = {
  empleado_id: number; nombre: string; tipo: string; dias_asistidos: number; medias: number; faltas: number;
  total_dias: number; total_tareas: number; ganado: number; abonos: number; saldo_anterior: number; neto: number;
  detalle: { tarea: string; unidad: string; cantidad: number; monto: number }[] | null;
};

/** Un periodo con sus filas: congeladas si está cerrado; calculadas al momento si está abierto. */
export async function cargarPeriodo(id: number) {
  const supabase = await crearClienteServidor();
  const { data: periodo } = await supabase.from("periodos_nomina").select("id, desde, hasta, estado, cerrado_el, nota, profiles:cerrado_por(nombre)").eq("id", id).maybeSingle();
  if (!periodo) return null;
  let filas: FilaPeriodo[];
  if (periodo.estado === "cerrado") {
    const { data } = await supabase.from("periodo_nomina_items")
      .select("empleado_id, dias_asistidos, medias, faltas, total_dias, total_tareas, ganado, abonos, saldo_anterior, neto, detalle, empleados(nombre, tipo)")
      .eq("periodo_id", id);
    filas = (data ?? []).map((r) => ({
      empleado_id: r.empleado_id, nombre: r.empleados?.nombre ?? "", tipo: r.empleados?.tipo ?? "", dias_asistidos: r.dias_asistidos, medias: r.medias, faltas: r.faltas,
      total_dias: Number(r.total_dias), total_tareas: Number(r.total_tareas), ganado: Number(r.ganado), abonos: Number(r.abonos),
      saldo_anterior: Number(r.saldo_anterior), neto: Number(r.neto), detalle: r.detalle as FilaPeriodo["detalle"],
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  } else {
    const [{ data }, { data: tareas }] = await Promise.all([
      supabase.rpc("nomina_resumen", { p_desde: periodo.desde, p_hasta: periodo.hasta }),
      supabase.from("jornada_tareas").select("cantidad, subtotal, tareas_nomina(nombre, unidad), jornadas!inner(empleado_id, fecha)")
        .gte("jornadas.fecha", periodo.desde).lte("jornadas.fecha", periodo.hasta),
    ]);
    const detalle = new Map<number, Map<string, { tarea: string; unidad: string; cantidad: number; monto: number }>>();
    for (const t of tareas ?? []) {
      const m = detalle.get(t.jornadas.empleado_id) ?? new Map();
      const k = t.tareas_nomina?.nombre ?? "Tarea";
      const x = m.get(k) ?? { tarea: k, unidad: t.tareas_nomina?.unidad ?? "", cantidad: 0, monto: 0 };
      x.cantidad += Number(t.cantidad); x.monto += Number(t.subtotal ?? 0);
      m.set(k, x); detalle.set(t.jornadas.empleado_id, m);
    }
    filas = (data ?? []).map((r) => ({
      empleado_id: r.empleado_id, nombre: r.nombre, tipo: r.tipo, dias_asistidos: Number(r.dias_asistidos), medias: Number(r.medias), faltas: Number(r.faltas),
      total_dias: Number(r.total_dias), total_tareas: Number(r.total_tareas), ganado: Number(r.ganado), abonos: Number(r.abonos),
      saldo_anterior: Number(r.saldo_anterior), neto: Number(r.neto), detalle: [...(detalle.get(r.empleado_id)?.values() ?? [])],
    })).filter((r) => r.ganado || r.abonos || r.saldo_anterior);
  }
  const cerradoPor = (periodo.profiles as { nombre: string } | null)?.nombre ?? null;
  return { periodo: { ...periodo, estado: periodo.estado as "abierto" | "cerrado", cerradoPor }, filas };
}
