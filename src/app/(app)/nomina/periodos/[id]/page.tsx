import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cargarPeriodo } from "@/features/nomina/datos-periodo";
import { AccionesPeriodo } from "@/features/nomina/periodos";

export const metadata: Metadata = { title: "Periodo de nómina" };
const cop = (v: number) => formatearMonto(v, "COP", { sinCodigo: true });

export default async function PaginaPeriodo({ params }: PageProps<"/nomina/periodos/[id]">) {
  const perfil = await exigirPerfil("nomina");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const datos = await cargarPeriodo(id);
  if (!datos) notFound();
  const { periodo, filas } = datos;
  const suma = (k: "ganado" | "abonos" | "saldo_anterior" | "neto") => filas.reduce((a, f) => a + f[k], 0);
  const cerrado = periodo.estado === "cerrado";

  return (
    <>
      <Link href="/nomina/periodos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Periodos</Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold sm:text-2xl">Periodo {formatearFecha(periodo.desde)} – {formatearFecha(periodo.hasta)}</h1>
          <p className="text-sm text-muted-foreground">
            <Badge variant="outline" className={cn("mr-2", cerrado ? "" : "border-success/40 text-success")}>{cerrado ? "Cerrado" : "Abierto"}</Badge>
            {cerrado ? `Cerrado el ${formatearFechaHora(periodo.cerrado_el)}${periodo.cerradoPor ? ` por ${periodo.cerradoPor}` : ""}` : "Los montos se calculan con lo registrado hasta ahora."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/nomina/periodos/${id}/recibos`} className={buttonVariants({ size: "lg", variant: "outline" })}><Printer className="size-4" /> Recibos</Link>
          <a href={`/nomina/periodos/${id}/excel`} className={buttonVariants({ size: "lg", variant: "outline" })}><Download className="size-4" /> Excel</a>
          <AccionesPeriodo id={id} estado={periodo.estado} desde={periodo.desde} hasta={periodo.hasta} neto={filas.reduce((a, f) => a + Math.max(f.neto, 0), 0)} usuario={perfil.nombre} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([["Ganado", suma("ganado")], ["Abonos", suma("abonos")], ["Saldo anterior", suma("saldo_anterior")], ["Total a pagar", suma("neto")]] as const).map(([t, v]) => (
          <div key={t} className="rounded-2xl border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</p>
            <p className="tabular text-lg font-bold">{formatearMonto(v, "COP")}</p>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Empleado</th><th className="p-3 text-center">Días</th><th className="p-3 text-right">Por días</th><th className="p-3 text-right">Por tareas</th>
              <th className="p-3 text-right">Ganado</th><th className="p-3 text-right">Abonos</th><th className="p-3 text-right">Saldo ant.</th><th className="p-3 text-right">A pagar</th></tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((f) => (
              <tr key={f.empleado_id}>
                <td className="p-3"><Link href={`/nomina/${f.empleado_id}`} className="font-medium hover:text-primary">{f.nombre}</Link></td>
                <td className="tabular p-3 text-center">{f.dias_asistidos}{f.medias ? ` + ${f.medias}½` : ""}{f.faltas ? <span className="text-destructive"> · {f.faltas} f</span> : ""}</td>
                <td className="tabular p-3 text-right">{cop(f.total_dias)}</td>
                <td className="tabular p-3 text-right">{cop(f.total_tareas)}</td>
                <td className="tabular p-3 text-right font-medium">{cop(f.ganado)}</td>
                <td className="tabular p-3 text-right">{f.abonos ? `− ${cop(f.abonos)}` : "—"}</td>
                <td className="tabular p-3 text-right">{f.saldo_anterior ? cop(f.saldo_anterior) : "—"}</td>
                <td className={cn("tabular p-3 text-right font-bold", f.neto > 0 && "text-warning")}>{cop(f.neto)}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin jornadas ni abonos en este periodo.</td></tr>}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {filas.map((f) => (
          <li key={f.empleado_id} className="rounded-2xl border bg-card p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/nomina/${f.empleado_id}`} className="font-medium">{f.nombre}</Link>
              <span className={cn("tabular font-bold", f.neto > 0 && "text-warning")}>{formatearMonto(f.neto, "COP")}</span>
            </div>
            <p className="tabular text-xs text-muted-foreground">Ganado {cop(f.ganado)} · abonos {cop(f.abonos)}{f.saldo_anterior ? ` · saldo ant. ${cop(f.saldo_anterior)}` : ""}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
