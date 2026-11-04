import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { sumarDias } from "@/lib/fechas";
import { cargarEmpleados, cargarJornadas, cargarTareas, cargarUltimosPagos, configNomina, periodosCerrados } from "@/features/nomina/datos";
import { ListaEmpleados } from "@/features/nomina/lista-empleados";
import { FichaEmpleado, type Pestana } from "@/features/nomina/ficha";

export const metadata: Metadata = { title: "Empleado" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const PESTANAS: Pestana[] = ["calendario", "panel", "abonos", "reporte"];
const finMes = (mes: string) => { const [a, m] = mes.split("-").map(Number); return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`; };

export default async function PaginaEmpleado({ params, searchParams }: PageProps<"/nomina/[id]">) {
  const perfil = await exigirPerfil("nomina");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const { hoy, inicioSemana } = await configNomina();
  const pestana = (PESTANAS.includes(t(sp.pestana) as Pestana) ? t(sp.pestana) : "calendario") as Pestana;
  const mes = /^\d{4}-\d{2}$/.test(t(sp.mes)) ? t(sp.mes) : hoy.slice(0, 7);
  // "Desde el último pago": el pago cubre hasta su fecha, así que se cuenta desde el día siguiente
  const ultimoPago = (await cargarUltimosPagos(id)).get(id) ?? null;
  const desdePago = ultimoPago ? sumarDias(ultimoPago.fecha, 1) : null;
  // Reporte: por defecto desde el último pago (o desde el inicio del mes si nunca se le pagó) hasta hoy
  const repDesde = fecha(t(sp.desde)) || desdePago || `${hoy.slice(0, 7)}-01`;
  const repHasta = fecha(t(sp.hasta)) || hoy;
  const supabase = await crearClienteServidor();

  const [{ data: empleado }, empleados, tareas, jornadasMes, cerrados, { data: abonos }, jornadasRep, jornadasDesdePago] = await Promise.all([
    supabase.from("empleados").select("id, nombre, cedula, telefono, cargo, tipo, tarifa_dia, fecha_ingreso, activo, notas").eq("id", id).maybeSingle(),
    cargarEmpleados(),
    cargarTareas(),
    cargarJornadas(id, `${mes}-01`, finMes(mes)),
    periodosCerrados(`${mes}-01` < repDesde ? `${mes}-01` : repDesde, finMes(mes) > repHasta ? finMes(mes) : repHasta),
    supabase.from("abonos_empleados").select("id, fecha, monto, tipo, entregado_por, nota, periodo_id").eq("empleado_id", id).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(500),
    pestana === "reporte" ? cargarJornadas(id, repDesde, repHasta) : Promise.resolve([]),
    pestana === "panel" ? cargarJornadas(id, desdePago ?? "2000-01-01", "2100-12-31") : Promise.resolve([]),
  ]);
  if (!empleado) notFound();
  const listaAbonos = (abonos ?? []).map((a) => ({ ...a, monto: Number(a.monto) }));

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="hidden lg:block"><ListaEmpleados empleados={empleados} tareas={tareas} seleccionado={id} /></div>
      <FichaEmpleado
        empleado={{ ...empleado, tipo: empleado.tipo as "fijo" | "destajo", tarifa_dia: Number(empleado.tarifa_dia) }}
        saldo={empleados.find((e) => e.id === id)?.saldo_neto ?? 0}
        pestana={pestana} mes={mes} hoy={hoy} inicioSemana={inicioSemana}
        jornadasMes={jornadasMes} cerrados={cerrados} tareas={tareas} abonos={listaAbonos}
        ultimoPago={ultimoPago} desdePago={desdePago} jornadasDesdePago={jornadasDesdePago}
        reporte={{ desde: repDesde, hasta: repHasta, jornadas: jornadasRep, abonos: listaAbonos.filter((a) => a.fecha >= repDesde && a.fecha <= repHasta) }}
        usuario={perfil.nombre}
      />
    </div>
  );
}
