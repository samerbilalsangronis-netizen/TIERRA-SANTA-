import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarRange, Users, Wallet } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { cargarEmpleados, cargarTareas, configNomina } from "@/features/nomina/datos";
import { ListaEmpleados } from "@/features/nomina/lista-empleados";
import { BotonNuevoEmpleado } from "@/features/nomina/dialogos";

export const metadata: Metadata = { title: "Nómina" };

export default async function PaginaNomina() {
  await exigirPerfil("nomina");
  const { actual } = await configNomina();
  const supabase = await crearClienteServidor();
  const [empleados, tareas, { data: resumen }] = await Promise.all([
    cargarEmpleados(), cargarTareas(), supabase.rpc("nomina_resumen", { p_desde: actual.desde, p_hasta: actual.hasta }),
  ]);
  const porPagar = empleados.reduce((a, e) => a + Math.max(e.saldo_neto, 0), 0);
  const ganadoPeriodo = (resumen ?? []).reduce((a, r) => a + Number(r.ganado), 0);
  const abonosPeriodo = (resumen ?? []).reduce((a, r) => a + Number(r.abonos), 0);

  return (
    <>
      <EncabezadoPagina icono={Wallet} titulo="Nómina" descripcion={`Periodo actual: ${formatearFecha(actual.desde)} – ${formatearFecha(actual.hasta)} · montos en COP`}
        acciones={
          <>
            <Link href="/nomina/asistencia" className={buttonVariants({ size: "lg", className: "bg-success text-black hover:bg-success/85" })}><CalendarCheck className="size-4" /> Asistencia de hoy</Link>
            <Link href="/nomina/periodos" className={buttonVariants({ size: "lg", variant: "outline" })}><CalendarRange className="size-4" /> Periodos y recibos</Link>
            <BotonNuevoEmpleado />
          </>
        } />
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TarjetaKpi titulo="Ganado en el periodo" icono={Wallet} valor={formatearMonto(ganadoPeriodo, "COP")} detalle={`Abonos: ${formatearMonto(abonosPeriodo, "COP")}`} />
        <TarjetaKpi titulo="Total que se debe" icono={Wallet} tono={porPagar > 0 ? "alerta" : "exito"} valor={formatearMonto(porPagar, "COP")} detalle="Ganado − abonos, de todos" />
        <TarjetaKpi titulo="Empleados activos" icono={Users} valor={empleados.filter((e) => e.activo).length}
          detalle={`${empleados.filter((e) => e.activo && e.tipo === "fijo").length} fijos · ${empleados.filter((e) => e.activo && e.tipo === "destajo").length} por destajo`} />
      </section>
      <div className="lg:max-w-md">
        <ListaEmpleados empleados={empleados} tareas={tareas} />
      </div>
    </>
  );
}
