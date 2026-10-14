"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Lock, LockOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { cerrarPeriodo, crearPeriodo, eliminarPeriodo, reabrirPeriodo } from "./acciones";

/** Crear un periodo (viene propuesto el siguiente según Configuración). */
export function NuevoPeriodo({ sugerido }: { sugerido: { desde: string; hasta: string } }) {
  const router = useRouter();
  const [desde, setDesde] = useState(sugerido.desde);
  const [hasta, setHasta] = useState(sugerido.hasta);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3">
      <div className="space-y-1"><Label htmlFor="p-desde">Desde</Label><Input id="p-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-[10rem]" /></div>
      <div className="space-y-1"><Label htmlFor="p-hasta">Hasta</Label><Input id="p-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-[10rem]" /></div>
      <Button disabled={pendiente} onClick={() => iniciar(async () => {
        const r = await crearPeriodo(desde, hasta);
        if (!r.ok) { toast.error(r.error); return; }
        toast.success(r.mensaje);
        router.push(`/nomina/periodos/${r.datos.id}`);
      })}>{pendiente ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />} Crear periodo</Button>
    </div>
  );
}

/** Cerrar / reabrir / eliminar un periodo. */
export function AccionesPeriodo({ id, estado, desde, hasta, neto, usuario }: {
  id: number; estado: "abierto" | "cerrado"; desde: string; hasta: string; neto: number; usuario: string;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<"cerrar" | "reabrir" | "eliminar" | null>(null);
  const [liquidar, setLiquidar] = useState(true);
  const [entregado, setEntregado] = useState(usuario);
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const ejecutar = (accion: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>, despues?: () => void) => iniciar(async () => {
    const r = await accion();
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.mensaje);
    setDialogo(null);
    if (despues) despues(); else router.refresh();
  });
  const rango = `${formatearFecha(desde)} – ${formatearFecha(hasta)}`;

  return (
    <>
      {estado === "abierto" ? (
        <>
          <Button size="lg" onClick={() => setDialogo("cerrar")}><Lock className="size-4" /> Cerrar periodo</Button>
          <Button size="lg" variant="outline" onClick={() => setDialogo("eliminar")} aria-label="Eliminar periodo"><Trash2 className="size-4" /></Button>
        </>
      ) : (
        <Button size="lg" variant="outline" onClick={() => { setMotivo(""); setDialogo("reabrir"); }}><LockOpen className="size-4" /> Reabrir</Button>
      )}
      <AlertDialog open={dialogo !== null} onOpenChange={(v) => !v && setDialogo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogo === "cerrar" ? `¿Cerrar el periodo ${rango}?` : dialogo === "reabrir" ? `¿Reabrir el periodo ${rango}?` : `¿Eliminar el periodo ${rango}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogo === "cerrar" ? "Se congela lo ganado: ya no se podrán cambiar jornadas ni abonos de esas fechas. Los recibos quedan listos para imprimir."
                : dialogo === "reabrir" ? "Se podrán volver a cambiar jornadas y abonos. Si al cerrar se registró el pago, ese pago se quita y se vuelve a calcular al cerrar de nuevo."
                : "Solo se borra el periodo; las jornadas y abonos no cambian."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialogo === "cerrar" && (
            <div className="space-y-3">
              <label className="flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                <span>Registrar el pago de lo que se debe ({formatearMonto(neto, "COP")}) y dejar los saldos en 0</span>
                <Switch checked={liquidar} onCheckedChange={(v) => setLiquidar(Boolean(v))} />
              </label>
              {liquidar && <div className="space-y-1"><Label htmlFor="entregado">Pagado por</Label><Input id="entregado" value={entregado} onChange={(e) => setEntregado(e.target.value)} /></div>}
            </div>
          )}
          {dialogo === "reabrir" && <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" aria-label="Motivo" />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant={dialogo === "eliminar" ? "destructive" : "default"} disabled={pendiente || (dialogo === "reabrir" && motivo.trim().length < 3)}
              onClick={() => dialogo === "cerrar" ? ejecutar(() => cerrarPeriodo(id, liquidar, entregado))
                : dialogo === "reabrir" ? ejecutar(() => reabrirPeriodo(id, motivo))
                : ejecutar(() => eliminarPeriodo(id), () => router.push("/nomina/periodos"))}>
              {pendiente && <Loader2 className="size-4 animate-spin" />}
              {dialogo === "cerrar" ? "Cerrar periodo" : dialogo === "reabrir" ? "Reabrir" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
