"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ListChecks, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EstadoJornada } from "@/lib/calculos/nomina";
import { formatearMonto } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { guardarJornada } from "./acciones";
import { DialogoJornada } from "./dialogos";
import type { JornadaDia, Tarea } from "./datos";

type Empleado = { id: number; nombre: string; tipo: "fijo" | "destajo"; tarifa_dia: number; cargo: string | null };

const BOTONES: Record<"fijo" | "destajo", { valor: EstadoJornada; texto: string }[]> = {
  fijo: [{ valor: "asistio", texto: "Asistió" }, { valor: "media", texto: "Media" }, { valor: "no", texto: "No" }],
  destajo: [{ valor: "asistio", texto: "Asistió" }, { valor: "no", texto: "No" }],
};

/** Registro rápido de asistencia: todos los empleados en una lista, un toque guarda. */
export function Asistencia({ fecha, empleados, jornadas, tareas, cerrado }: {
  fecha: string; empleados: Empleado[]; jornadas: (JornadaDia & { empleado_id: number })[]; tareas: Tarea[]; cerrado: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [guardando, setGuardando] = useState<number | null>(null);
  const [, iniciar] = useTransition();
  const [detalle, setDetalle] = useState<Empleado | null>(null);
  const porEmpleado = new Map(jornadas.map((j) => [j.empleado_id, j]));
  const marcados = empleados.filter((e) => porEmpleado.has(e.id)).length;
  const total = jornadas.reduce((a, j) => a + j.ganado, 0);

  function marcar(e: Empleado, estado: EstadoJornada) {
    const j = porEmpleado.get(e.id);
    setGuardando(e.id);
    iniciar(async () => {
      const r = await guardarJornada({
        empleado_id: e.id, fecha, estado, justificada: false,
        pago_adicional: estado === "no" ? 0 : j?.pago_adicional ?? 0, nota: j?.nota ?? "",
        tareas: estado === "no" ? [] : (j?.jornada_tareas ?? []).map((t) => ({ tarea_id: t.tarea_id, cantidad: t.cantidad, valor_unitario: t.valor_unitario })),
      });
      setGuardando(null);
      if (!r.ok) { toast.error(r.error); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <Link href="/nomina" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Nómina</Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold sm:text-2xl">Asistencia del día</h1>
          <p className="text-sm text-muted-foreground">{marcados} de {empleados.length} registrados · ganado del día <b className="tabular text-foreground">{formatearMonto(total, "COP")}</b></p>
        </div>
        <Input type="date" value={fecha} onChange={(e) => e.target.value && router.replace(`${ruta}?fecha=${e.target.value}`)} className="w-[10rem]" aria-label="Fecha" />
      </div>
      {cerrado && <p className="mb-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground"><Lock className="size-4" /> Esta fecha está en un periodo cerrado.</p>}

      <ul className="space-y-2">
        {empleados.map((e) => {
          const j = porEmpleado.get(e.id);
          const actual = j ? (j.estado === "produccion" ? "asistio" : j.estado) : null;
          return (
            <li key={e.id} className="rounded-2xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-40">
                  <Link href={`/nomina/${e.id}`} className="block truncate font-medium hover:text-primary">{e.nombre}</Link>
                  <p className="text-xs text-muted-foreground">
                    {e.tipo === "fijo" ? "Fijo" : "Por tarea"}
                    {j && <> · ganado <b className="tabular text-foreground">{formatearMonto(j.ganado, "COP", { sinCodigo: true })}</b></>}
                  </p>
                </div>
                <div className="flex flex-1 basis-60 gap-1.5" role="radiogroup" aria-label={`Asistencia de ${e.nombre}`}>
                  {BOTONES[e.tipo].map((b) => (
                    <button key={b.valor} type="button" role="radio" aria-checked={actual === b.valor} disabled={cerrado || guardando === e.id}
                      onClick={() => actual !== b.valor && marcar(e, b.valor)}
                      className={cn("h-12 flex-1 rounded-xl border text-sm font-medium transition-colors disabled:opacity-60",
                        actual === b.valor ? (b.valor === "no" ? "border-destructive bg-destructive/15 text-destructive" : b.valor === "media" ? "border-warning bg-warning/15 text-warning" : "border-success bg-success/15 text-success")
                          : "text-muted-foreground hover:bg-muted")}>
                      {guardando === e.id && actual !== b.valor ? <Loader2 className="mx-auto size-4 animate-spin" /> : b.texto}
                    </button>
                  ))}
                  <Button variant="outline" className="h-12" onClick={() => setDetalle(e)} aria-label={`Tareas y detalle de ${e.nombre}`}><ListChecks className="size-4" /><span className="hidden sm:inline">Tareas</span></Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {detalle && (
        <DialogoJornada empleado={detalle} fecha={fecha} jornada={porEmpleado.get(detalle.id)} tareas={tareas} bloqueada={cerrado} onCerrar={() => setDetalle(null)} />
      )}
    </div>
  );
}
