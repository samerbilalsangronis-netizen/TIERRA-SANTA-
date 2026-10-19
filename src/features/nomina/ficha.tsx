"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, HandCoins, Lock, MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { diasDelMes } from "@/lib/calculos/nomina";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { eliminarAbono, eliminarEmpleado } from "./acciones";
import { DialogoAbono, DialogoEmpleado, DialogoJornada, type AbonoEditable, type EmpleadoEditable } from "./dialogos";
import type { JornadaDia, Tarea } from "./datos";

type Abono = AbonoEditable & { tipo: string };
type Resumen = { ganado: number; abonos: number; neto: number; saldo_anterior: number; dias_asistidos: number; medias: number; faltas: number; total_tareas: number };
export type Pestana = "calendario" | "panel" | "abonos" | "reporte";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const cop = (v: number) => formatearMonto(v, "COP");
const corto = (v: number) => (v >= 1_000_000 ? `${formatearCantidad(v / 1_000_000, 1)} M` : v >= 1000 ? `${formatearCantidad(v / 1000, 1)} mil` : formatearCantidad(v, 0));
const mesSiguiente = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function FichaEmpleado(props: {
  empleado: EmpleadoEditable; saldo: number; pestana: Pestana; mes: string; hoy: string; inicioSemana: number;
  jornadasMes: JornadaDia[]; cerrados: { desde: string; hasta: string }[]; tareas: Tarea[]; abonos: Abono[];
  periodo: { desde: string; hasta: string }; resumen: Resumen; reporte: { desde: string; hasta: string; jornadas: JornadaDia[]; abonos: Abono[] };
  usuario: string;
}) {
  const { empleado, saldo, pestana, mes, hoy, inicioSemana, jornadasMes, cerrados, tareas, abonos, periodo, resumen, reporte, usuario } = props;
  const router = useRouter();
  const ruta = usePathname();
  const [dialogo, setDialogo] = useState<{ tipo: "jornada"; fecha: string } | { tipo: "abono"; abono?: AbonoEditable } | { tipo: "editar" } | { tipo: "eliminar" } | { tipo: "eliminarAbono"; abono: Abono } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const ir = (cambio: Record<string, string>) => {
    const qs = new URLSearchParams({ pestana, mes, ...cambio });
    if (qs.get("pestana") === "calendario") qs.delete("pestana");
    router.replace(`${ruta}?${qs}`, { scroll: false });
  };
  const porFecha = new Map(jornadasMes.map((j) => [j.fecha, j]));
  const bloqueada = (f: string) => cerrados.some((c) => f >= c.desde && f <= c.hasta);
  const totalMes = jornadasMes.reduce((a, j) => a + j.ganado, 0);
  const [anio, numMes] = mes.split("-").map(Number);

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>, alTerminar?: () => void) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) { toast.success(r.mensaje ?? "Listo."); router.refresh(); alTerminar?.(); } else toast.error(r.error);
      setDialogo(null);
    });
  }

  return (
    <div className="min-w-0">
      <Link href="/nomina" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft className="size-4" /> Personal
      </Link>

      {/* Encabezado */}
      <section className="mb-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-xl font-bold text-primary">{empleado.nombre.trim().charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-lg font-bold sm:text-2xl">{empleado.nombre}</h1>
              <Badge variant="outline">{empleado.tipo === "fijo" ? `Fijo · ${cop(empleado.tarifa_dia)}/día` : "Por destajo"}</Badge>
              {!empleado.activo && <Badge variant="outline">Inactivo</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{[empleado.cargo, empleado.cedula && `C.I. ${empleado.cedula}`, empleado.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{saldo >= 0 ? "Se le debe" : "Recibió de más"}</p>
            <p className={cn("tabular text-xl font-bold", saldo > 0 ? "text-warning" : "text-success")} data-testid="saldo-empleado">{cop(Math.abs(saldo))}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="lg" className="bg-success text-black hover:bg-success/85" onClick={() => setDialogo({ tipo: "abono" })}><HandCoins className="size-4" /> Abonar</Button>
          <Button size="lg" variant="outline" onClick={() => setDialogo({ tipo: "editar" })}><Pencil className="size-4" /> Editar</Button>
          <Button size="lg" variant="outline" onClick={() => setDialogo({ tipo: "eliminar" })}><Trash2 className="size-4" /> Eliminar</Button>
        </div>
      </section>

      {/* Pestañas */}
      <nav className="mb-3 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1" aria-label="Secciones del empleado">
        {(["calendario", "panel", "abonos", "reporte"] as const).map((p) => (
          <button key={p} type="button" onClick={() => ir({ pestana: p })} aria-current={pestana === p ? "page" : undefined}
            className={cn("flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm capitalize", pestana === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {p}
          </button>
        ))}
      </nav>

      {/* ------------------------------------------------ Calendario */}
      {pestana === "calendario" && (
        <section className="rounded-2xl border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => ir({ mes: mesSiguiente(mes, -1) })}><ChevronLeft className="size-4" /> Ant.</Button>
            <div className="text-center">
              <p className="font-semibold capitalize">{MESES[numMes - 1]} {anio}</p>
              <p className="tabular text-xs text-muted-foreground">Ganado en el mes: <b className="text-foreground">{cop(totalMes)}</b></p>
            </div>
            <Button variant="outline" size="sm" onClick={() => ir({ mes: mesSiguiente(mes, 1) })}>Sig. <ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {Array.from({ length: 7 }, (_, i) => <span key={i}>{DIAS_CORTOS[(inicioSemana + i) % 7]}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {diasDelMes(mes, inicioSemana).map((f, i) => {
              if (!f) return <span key={i} />;
              const j = porFecha.get(f);
              const cerrado = bloqueada(f);
              const tono = !j ? "border-transparent bg-muted/40" : j.estado === "no" ? "border-destructive/40 bg-destructive/10" : j.estado === "media" ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10";
              return (
                <button key={f} type="button" onClick={() => setDialogo({ tipo: "jornada", fecha: f })} aria-label={`Jornada del ${formatearFecha(f)}${j ? `, ganado ${cop(j.ganado)}` : ""}`}
                  className={cn("relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border p-0.5 text-xs transition-colors hover:border-primary/50 sm:aspect-auto sm:h-16", tono, f === hoy && "ring-2 ring-primary")}>
                  <span className={cn("font-medium", f > hoy && !j && "text-muted-foreground")}>{Number(f.slice(8))}</span>
                  {j && (
                    <span className={cn("tabular text-[10px] leading-tight sm:text-[11px]", j.estado === "no" ? "text-destructive" : "text-success")}>
                      {j.estado === "no" ? (j.justificada ? "Just." : "Falta") : `$${corto(j.ganado)}`}
                    </span>
                  )}
                  {cerrado && <Lock className="absolute right-0.5 top-0.5 size-2.5 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Toca un día para registrar o cambiar la jornada. <Lock className="inline size-3" /> = periodo cerrado.</p>
        </section>
      )}

      {/* ------------------------------------------------ Panel */}
      {pestana === "panel" && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Periodo actual: {formatearFecha(periodo.desde)} – {formatearFecha(periodo.hasta)}</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["Ganado en el periodo", cop(resumen.ganado), ""],
              ["Abonos del periodo", cop(resumen.abonos), ""],
              ["Saldo anterior", cop(resumen.saldo_anterior), ""],
              ["A pagar al cierre", cop(resumen.neto), resumen.neto > 0 ? "text-warning" : "text-success"],
            ].map(([t, v, c]) => (
              <div key={t} className="rounded-2xl border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</p>
                <p className={cn("tabular text-lg font-bold", c)}>{v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Días asistidos", resumen.dias_asistidos], ["Medias jornadas", resumen.medias], ["Faltas", resumen.faltas]].map(([t, v]) => (
              <div key={t} className="rounded-2xl border bg-card p-3 text-center">
                <p className="tabular text-2xl font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{t}</p>
              </div>
            ))}
          </div>
          {empleado.tipo === "destajo" && <p className="text-sm text-muted-foreground">Por tareas en el periodo: <b className="tabular text-foreground">{cop(resumen.total_tareas)}</b></p>}
        </section>
      )}

      {/* ------------------------------------------------ Abonos */}
      {pestana === "abonos" && (
        abonos.length === 0 ? <EstadoVacio icono={HandCoins} titulo="Sin abonos" descripcion="Los adelantos que se le den aparecen aquí." /> : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {abonos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.tipo === "liquidacion" ? "Pago de cierre" : "Abono"} <span className="font-normal text-muted-foreground">· {formatearFecha(a.fecha)}</span></p>
                  <p className="text-xs text-muted-foreground">{[a.entregado_por && `Entregado por ${a.entregado_por}`, a.nota].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="tabular font-semibold">{cop(a.monto)}</p>
                {a.tipo === "adelanto" && !bloqueada(a.fecha) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones del abono del ${formatearFecha(a.fecha)}`}><MoreHorizontal className="size-4" /></Button>} />
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setDialogo({ tipo: "abono", abono: a })}><Pencil className="size-4" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDialogo({ tipo: "eliminarAbono", abono: a })}><Trash2 className="size-4" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <span className="inline-flex size-9 items-center justify-center">{bloqueada(a.fecha) && <Lock className="size-3.5 text-muted-foreground" />}</span>}
              </li>
            ))}
          </ul>
        )
      )}

      {/* ------------------------------------------------ Reporte */}
      {pestana === "reporte" && (
        <section>
          <div className="no-print mb-3 flex flex-wrap items-center gap-1.5">
            <Input type="date" aria-label="Desde" value={reporte.desde} onChange={(e) => ir({ desde: e.target.value })} className="h-9 w-[9.5rem] text-xs" />
            <Input type="date" aria-label="Hasta" value={reporte.hasta} onChange={(e) => ir({ hasta: e.target.value })} className="h-9 w-[9.5rem] text-xs" />
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="size-4" /> Imprimir</Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="p-2.5">Fecha</th><th className="p-2.5">Asistencia</th><th className="p-2.5">Tareas</th><th className="p-2.5 text-right">Ganado</th></tr>
              </thead>
              <tbody className="divide-y">
                {reporte.jornadas.map((j) => (
                  <tr key={j.id}>
                    <td className="whitespace-nowrap p-2.5">{formatearFecha(j.fecha)}</td>
                    <td className="p-2.5">{{ asistio: "Asistió", media: "Media jornada", produccion: "Asistió", no: j.justificada ? "Falta justificada" : "No asistió" }[j.estado]}</td>
                    <td className="p-2.5 text-xs text-muted-foreground">
                      {j.jornada_tareas.map((t) => `${tareas.find((x) => x.id === t.tarea_id)?.nombre ?? "Tarea"} × ${formatearCantidad(t.cantidad)}`).join(" · ")}
                      {j.pago_adicional > 0 && `${j.jornada_tareas.length ? " · " : ""}Adicional ${cop(j.pago_adicional)}`}
                    </td>
                    <td className="tabular p-2.5 text-right font-medium">{cop(j.ganado)}</td>
                  </tr>
                ))}
                {reporte.jornadas.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sin jornadas en estas fechas.</td></tr>}
              </tbody>
              <tfoot className="border-t text-sm">
                <tr><td colSpan={3} className="p-2.5 font-medium">Total ganado</td><td className="tabular p-2.5 text-right font-bold">{cop(reporte.jornadas.reduce((a, j) => a + j.ganado, 0))}</td></tr>
                <tr><td colSpan={3} className="p-2.5 text-muted-foreground">Abonos en estas fechas</td><td className="tabular p-2.5 text-right">− {cop(reporte.abonos.reduce((a, x) => a + x.monto, 0))}</td></tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Diálogos */}
      {dialogo?.tipo === "jornada" && (
        <DialogoJornada empleado={empleado} fecha={dialogo.fecha} jornada={porFecha.get(dialogo.fecha)} tareas={tareas}
          bloqueada={bloqueada(dialogo.fecha)} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === "abono" && (
        <DialogoAbono empleadoId={empleado.id} nombre={empleado.nombre} hoy={hoy} abono={dialogo.abono} entregadoPor={usuario} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === "editar" && <DialogoEmpleado empleado={empleado} onCerrar={() => setDialogo(null)} />}
      <AlertDialog open={dialogo?.tipo === "eliminar" || dialogo?.tipo === "eliminarAbono"} onOpenChange={(v) => !v && setDialogo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogo?.tipo === "eliminarAbono" ? `¿Eliminar el abono de ${cop(dialogo.abono.monto)}?` : `¿Eliminar a ${empleado.nombre}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogo?.tipo === "eliminarAbono" ? "Queda registrado en la auditoría." : "Solo se puede eliminar si no tiene jornadas ni abonos; si tiene historial, desactívalo desde Editar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pendiente} onClick={() => {
              if (dialogo?.tipo === "eliminarAbono") ejecutar(() => eliminarAbono(dialogo.abono.id));
              else ejecutar(() => eliminarEmpleado(empleado.id), () => router.push("/nomina"));
            }}>Eliminar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
