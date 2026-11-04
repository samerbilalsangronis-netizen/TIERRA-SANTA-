import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CalendarCheck, Users, Wallet } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearMonto } from "@/lib/dinero";
import { hoyISO } from "@/lib/fechas";
import { rangoPeriodo } from "@/lib/periodos";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { cargarEmpleados, cargarTareas } from "@/features/nomina/datos";
import { ListaEmpleados } from "@/features/nomina/lista-empleados";
import { BotonNuevoEmpleado } from "@/features/nomina/dialogos";
import { PagarFijos } from "@/features/nomina/pagar-fijos";

export const metadata: Metadata = { title: "Nómina" };

/**
 * Nómina sin periodos: cada empleado tiene lo que se le debe (ganado − pagos y adelantos)
 * y su última fecha de pago. Los fijos se pagan cada semana con "Pagar a los fijos";
 * los de destajo cuando toca, desde su ficha.
 */
export default async function PaginaNomina() {
  const perfil = await exigirPerfil("nomina");
  const hoy = hoyISO();
  const semana = rangoPeriodo("semana", hoy).actual;
  const supabase = await crearClienteServidor();
  const [empleados, tareas, { data: pagadoSemana }] = await Promise.all([
    cargarEmpleados(), cargarTareas(),
    supabase.from("abonos_empleados").select("monto").gte("fecha", semana.desde).lte("fecha", semana.hasta),
  ]);
  const debe = (tipo: "fijo" | "destajo") => empleados.filter((e) => e.tipo === tipo).reduce((a, e) => a + Math.max(e.saldo_neto, 0), 0);
  const pagado = (pagadoSemana ?? []).reduce((a, x) => a + Number(x.monto), 0);

  return (
    <>
      <EncabezadoPagina icono={Wallet} titulo="Nómina" descripcion="Lo que se le debe a cada empleado y cuándo se le pagó por última vez · montos en COP"
        acciones={
          <>
            <Link href="/nomina/asistencia" className={buttonVariants({ size: "lg", className: "bg-success text-black hover:bg-success/85" })}><CalendarCheck className="size-4" /> Asistencia de hoy</Link>
            <PagarFijos empleados={empleados} hoy={hoy} usuario={perfil.nombre} />
            <BotonNuevoEmpleado />
          </>
        } />
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TarjetaKpi titulo="Total que se debe" icono={Wallet} tono={debe("fijo") + debe("destajo") > 0 ? "alerta" : "exito"}
          valor={formatearMonto(debe("fijo") + debe("destajo"), "COP")}
          detalle={`Fijos ${formatearMonto(debe("fijo"), "COP", { sinCodigo: true })} · Destajo ${formatearMonto(debe("destajo"), "COP", { sinCodigo: true })}`} />
        <TarjetaKpi titulo="Pagado esta semana" icono={Banknote} valor={formatearMonto(pagado, "COP")} detalle="Pagos y adelantos desde el lunes" />
        <TarjetaKpi titulo="Empleados activos" icono={Users} valor={empleados.filter((e) => e.activo).length}
          detalle={`${empleados.filter((e) => e.activo && e.tipo === "fijo").length} fijos · ${empleados.filter((e) => e.activo && e.tipo === "destajo").length} por destajo`} />
      </section>
      <div className="lg:max-w-md">
        <ListaEmpleados empleados={empleados} tareas={tareas} />
      </div>
    </>
  );
}
