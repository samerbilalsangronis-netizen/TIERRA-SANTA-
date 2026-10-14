import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Lock, LockOpen } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { periodoDeFecha } from "@/lib/calculos/nomina";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha, sumarDias } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { configNomina } from "@/features/nomina/datos";
import { NuevoPeriodo } from "@/features/nomina/periodos";

export const metadata: Metadata = { title: "Periodos de nómina" };

export default async function PaginaPeriodos() {
  await exigirPerfil("nomina");
  const { actual, periodicidad, inicioSemana } = await configNomina();
  const supabase = await crearClienteServidor();
  const { data: periodos } = await supabase.from("periodos_nomina").select("id, desde, hasta, estado, cerrado_el, periodo_nomina_items(neto)").order("desde", { ascending: false }).limit(200);
  const ultimo = periodos?.[0];
  const sugerido = ultimo ? periodoDeFecha(sumarDias(ultimo.hasta, 1), periodicidad, inicioSemana) : actual;

  return (
    <>
      <Link href="/nomina" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Nómina</Link>
      <h1 className="mb-1 font-heading text-xl font-bold sm:text-2xl">Periodos y recibos</h1>
      <p className="mb-4 text-sm text-muted-foreground">Al cerrar un periodo se congela lo ganado, se descuentan los abonos y quedan los recibos de cada empleado. Periodicidad: {periodicidad} (se cambia en Configuración → Empresa).</p>
      <div className="mb-4"><NuevoPeriodo sugerido={sugerido} /></div>
      {(periodos ?? []).length === 0 ? <EstadoVacio icono={CalendarRange} titulo="Sin periodos" descripcion="Crea el primero con las fechas de arriba." /> : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {(periodos ?? []).map((p) => {
            const cerrado = p.estado === "cerrado";
            const neto = p.periodo_nomina_items.reduce((a, x) => a + Number(x.neto), 0);
            return (
              <li key={p.id}>
                <Link href={`/nomina/periodos/${p.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/40">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", cerrado ? "bg-muted text-muted-foreground" : "bg-success/12 text-success")}>
                    {cerrado ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatearFecha(p.desde)} – {formatearFecha(p.hasta)}</p>
                    <p className="text-xs text-muted-foreground">{cerrado ? `Cerrado el ${formatearFecha(p.cerrado_el)}` : "Abierto"}</p>
                  </div>
                  {cerrado && <span className="tabular text-sm font-semibold">{formatearMonto(neto, "COP")}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
