import type { Metadata } from "next";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarTareas, configNomina, periodosCerrados } from "@/features/nomina/datos";
import { Asistencia } from "@/features/nomina/asistencia";

export const metadata: Metadata = { title: "Asistencia" };

export default async function PaginaAsistencia({ searchParams }: PageProps<"/nomina/asistencia">) {
  await exigirPerfil("nomina");
  const { hoy } = await configNomina();
  const f = (await searchParams).fecha;
  const fecha = typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoy;
  const supabase = await crearClienteServidor();
  const [{ data: empleados }, { data: jornadas }, tareas, cerrados] = await Promise.all([
    supabase.from("empleados").select("id, nombre, tipo, tarifa_dia, cargo").eq("activo", true).order("nombre"),
    supabase.from("jornadas").select("id, empleado_id, fecha, estado, justificada, pago_dia, pago_adicional, total_tareas, ganado, tarifa_aplicada, nota, jornada_tareas(tarea_id, cantidad, valor_unitario, subtotal)").eq("fecha", fecha),
    cargarTareas(),
    periodosCerrados(fecha, fecha),
  ]);
  return (
    <Asistencia fecha={fecha} cerrado={cerrados.length > 0} tareas={tareas}
      empleados={(empleados ?? []).map((e) => ({ ...e, tipo: e.tipo as "fijo" | "destajo", tarifa_dia: Number(e.tarifa_dia) }))}
      jornadas={(jornadas ?? []).map((j) => ({
        ...j, pago_dia: Number(j.pago_dia), pago_adicional: Number(j.pago_adicional), total_tareas: Number(j.total_tareas), ganado: Number(j.ganado ?? 0), tarifa_aplicada: Number(j.tarifa_aplicada),
        jornada_tareas: j.jornada_tareas.map((t) => ({ ...t, cantidad: Number(t.cantidad), valor_unitario: Number(t.valor_unitario), subtotal: Number(t.subtotal ?? 0) })),
      }))} />
  );
}
