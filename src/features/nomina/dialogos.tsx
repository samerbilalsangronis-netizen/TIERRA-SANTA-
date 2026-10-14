"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
import { Loader2, Lock, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { calcularJornada, type EstadoJornada } from "@/lib/calculos/nomina";
import { formatearCantidad, formatearMonto, parsearMonto } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { eliminarJornada, guardarAbono, guardarEmpleado, guardarJornada } from "./acciones";
import { esquemaAbono, esquemaEmpleado } from "./esquemas";
import type { JornadaDia, Tarea } from "./datos";

export type EmpleadoEditable = {
  id: number; nombre: string; cedula: string | null; telefono: string | null; cargo: string | null; tipo: "fijo" | "destajo";
  tarifa_dia: number; fecha_ingreso: string | null; activo: boolean; notas: string | null;
};

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));

// ------------------------------------------------------------------ Empleado
export function DialogoEmpleado({ empleado, onCerrar, alCrear }: { empleado?: EmpleadoEditable; onCerrar: () => void; alCrear?: (id: number) => void }) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaEmpleado,
    empleado
      ? { ...empleado, cedula: empleado.cedula ?? "", telefono: empleado.telefono ?? "", cargo: empleado.cargo ?? "", fecha_ingreso: empleado.fecha_ingreso ?? "", notas: empleado.notas ?? "", tarifa_dia: formatearCantidad(empleado.tarifa_dia, 2) }
      : { nombre: "", cedula: "", telefono: "", cargo: "", tipo: "destajo", tarifa_dia: "", fecha_ingreso: "", activo: true, notas: "" },
    async (d) => {
      const r = await guardarEmpleado(d);
      if (r.ok && !empleado && alCrear) alCrear(r.datos.id);
      return r.ok ? { ok: true, datos: undefined, mensaje: r.mensaje } : r;
    },
    onCerrar,
  );
  const tipo = form.watch("tipo");
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar} titulo={empleado ? `Editar ${empleado.nombre}` : "Nuevo empleado"}>
      <CampoTexto etiqueta="Nombre" requerido className="sm:col-span-2" error={err.nombre?.message} {...form.register("nombre")} />
      <CampoSelect etiqueta="Tipo de pago" {...form.register("tipo")}
        ayuda={tipo === "fijo" ? "Gana una tarifa por día trabajado (media jornada = mitad)." : "Gana por las tareas que hace (precio por cesta, etc.)."}>
        <option value="destajo">Por tarea (destajo)</option>
        <option value="fijo">Fijo (por día)</option>
      </CampoSelect>
      {tipo === "fijo" ? (
        <CampoTexto etiqueta="Gana por día (COP)" requerido inputMode="decimal" placeholder="40.000" error={err.tarifa_dia?.message} {...form.register("tarifa_dia")} />
      ) : <div className="hidden sm:block" />}
      <CampoTexto etiqueta="Cédula" {...form.register("cedula")} />
      <CampoTexto etiqueta="Teléfono" type="tel" inputMode="tel" {...form.register("telefono")} />
      <CampoTexto etiqueta="Cargo / área" {...form.register("cargo")} />
      <CampoTexto etiqueta="Fecha de ingreso" type="date" {...form.register("fecha_ingreso")} />
      <CampoArea etiqueta="Notas" rows={2} className="sm:col-span-2" {...form.register("notas")} />
      {empleado && (
        <Controller control={form.control} name="activo" render={({ field }) => (
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm sm:col-span-2">
            Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          </label>
        )} />
      )}
    </DialogoFormulario>
  );
}

// ------------------------------------------------------------------ Abono
export type AbonoEditable = { id: number; fecha: string; monto: number; entregado_por: string | null; nota: string | null };

export function DialogoAbono({ empleadoId, nombre, hoy, abono, entregadoPor, onCerrar }: {
  empleadoId: number; nombre: string; hoy: string; abono?: AbonoEditable; entregadoPor: string; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaAbono,
    abono
      ? { ...abono, empleado_id: empleadoId, monto: formatearCantidad(abono.monto, 2), entregado_por: abono.entregado_por ?? "", nota: abono.nota ?? "" }
      : { empleado_id: empleadoId, fecha: hoy, monto: "", entregado_por: entregadoPor, nota: "" },
    guardarAbono,
    onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar} titulo={abono ? "Editar abono" : `Abonar a ${nombre}`}
      descripcion="Adelanto en pesos (COP). Se descuenta de lo que se le debe." textoGuardar={abono ? "Guardar" : "Registrar abono"}>
      <CampoTexto etiqueta="Monto (COP)" requerido inputMode="decimal" autoFocus error={err.monto?.message} {...form.register("monto")} />
      <CampoTexto etiqueta="Fecha" type="date" error={err.fecha?.message} {...form.register("fecha")} />
      <CampoTexto etiqueta="Entregado por" {...form.register("entregado_por")} />
      <CampoTexto etiqueta="Nota" {...form.register("nota")} />
    </DialogoFormulario>
  );
}

// ------------------------------------------------------------------ Jornada
const ESTADOS: Record<"fijo" | "destajo", { valor: EstadoJornada; texto: string }[]> = {
  fijo: [{ valor: "asistio", texto: "Asistió" }, { valor: "media", texto: "Media jornada" }, { valor: "no", texto: "No asistió" }],
  destajo: [{ valor: "asistio", texto: "Asistió" }, { valor: "no", texto: "No asistió" }],
};

export function DialogoJornada({ empleado, fecha, jornada, tareas, bloqueada, onCerrar }: {
  empleado: { id: number; nombre: string; tipo: "fijo" | "destajo"; tarifa_dia: number };
  fecha: string; jornada?: JornadaDia; tareas: Tarea[]; bloqueada: boolean; onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [estado, setEstado] = useState<EstadoJornada>(jornada?.estado === "produccion" ? "asistio" : jornada?.estado ?? "asistio");
  const [justificada, setJustificada] = useState(jornada?.justificada ?? false);
  const [adicional, setAdicional] = useState(jornada?.pago_adicional ? formatearCantidad(jornada.pago_adicional, 2) : "");
  const [nota, setNota] = useState(jornada?.nota ?? "");
  const [cantidades, setCantidades] = useState<Record<number, string>>(
    Object.fromEntries((jornada?.jornada_tareas ?? []).map((t) => [t.tarea_id, formatearCantidad(t.cantidad, 2)])),
  );
  // Tareas visibles: las activas + las que ya tenga la jornada
  // El personal fijo cobra por día: no ve tareas
  const lista = empleado.tipo === "fijo" ? [] : tareas.filter((t) => t.activa || cantidades[t.id]);
  const valorDe = (t: Tarea) => jornada?.jornada_tareas.find((x) => x.tarea_id === t.id)?.valor_unitario ?? t.valor;
  const tarifa = jornada?.tarifa_aplicada || empleado.tarifa_dia;
  const asistio = estado !== "no";
  const calculo = calcularJornada({
    tipo: empleado.tipo, estado, tarifaDia: tarifa, pagoAdicional: asistio ? parsearMonto(adicional) ?? 0 : 0,
    tareas: asistio ? lista.map((t) => ({ cantidad: parsearMonto(cantidades[t.id] ?? "") ?? 0, valor: valorDe(t) })) : [],
  });

  function guardar() {
    iniciar(async () => {
      const r = await guardarJornada({
        empleado_id: empleado.id, fecha, estado, justificada: !asistio && justificada,
        pago_adicional: asistio ? adicional : "", nota,
        tareas: asistio ? lista.map((t) => ({ tarea_id: t.id, cantidad: cantidades[t.id] ?? "", valor_unitario: valorDe(t) })) : [],
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje);
      router.refresh();
      onCerrar();
    });
  }
  function borrar() {
    iniciar(async () => {
      const r = await eliminarJornada(empleado.id, fecha);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje);
      router.refresh();
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jornada: <span className="capitalize">{fechaLarga(fecha)}</span></DialogTitle>
          <DialogDescription>{empleado.nombre} · {empleado.tipo === "fijo" ? `Fijo, ${formatearMonto(tarifa, "COP")} por día` : "Por tarea"}</DialogDescription>
        </DialogHeader>
        {bloqueada && (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"><Lock className="size-4" /> Este día está en un periodo cerrado: no se puede cambiar.</p>
        )}
        <fieldset disabled={bloqueada || pendiente} className="space-y-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${ESTADOS[empleado.tipo].length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Asistencia">
            {ESTADOS[empleado.tipo].map((e) => (
              <button key={e.valor} type="button" role="radio" aria-checked={estado === e.valor} onClick={() => setEstado(e.valor)}
                className={cn("h-12 rounded-xl border text-sm font-medium transition-colors",
                  estado === e.valor ? (e.valor === "no" ? "border-destructive bg-destructive/15 text-destructive" : "border-success bg-success/15 text-success") : "text-muted-foreground hover:bg-muted")}>
                {e.texto}
              </button>
            ))}
          </div>
          {!asistio && (
            <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
              Falta justificada <Switch checked={justificada} onCheckedChange={(v) => setJustificada(Boolean(v))} />
            </label>
          )}

          {asistio && (
            <>
              {empleado.tipo === "destajo" && (<div>
                <p className="mb-1.5 text-sm font-medium">Tareas</p>
                <ul className="divide-y rounded-xl border">
                  {lista.map((t) => {
                    const cant = parsearMonto(cantidades[t.id] ?? "");
                    return (
                      <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{t.emoji} {t.nombre}</p>
                          <p className="text-xs text-muted-foreground">{formatearMonto(valorDe(t), "COP", { sinCodigo: true })} / {t.unidad}</p>
                        </div>
                        <Input inputMode="decimal" placeholder="0" value={cantidades[t.id] ?? ""} aria-label={`Cantidad de ${t.nombre}`}
                          onChange={(ev) => setCantidades((c) => ({ ...c, [t.id]: ev.target.value }))} className="h-10 w-20 text-right tabular" />
                        <span className="tabular w-20 text-right text-sm font-medium">{cant && cant.gt(0) ? formatearMonto(cant.times(valorDe(t)), "COP", { sinCodigo: true }) : "—"}</span>
                      </li>
                    );
                  })}
                  {lista.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No hay tareas. Créalas en Configuración → Catálogos → Tareas.</li>}
                </ul>
              </div>)}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adicional">Pago adicional por día (COP)</Label>
                  <Input id="adicional" inputMode="decimal" placeholder="0" value={adicional} onChange={(e) => setAdicional(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nota-jornada">Nota</Label>
                  <Input id="nota-jornada" value={nota} onChange={(e) => setNota(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </fieldset>
        <DialogFooter className="sticky -bottom-4 flex-row flex-wrap items-center bg-popover">
          <div className="mr-auto">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ganado hoy</p>
            <p className="tabular text-lg font-bold" data-testid="ganado-hoy">{formatearMonto(calculo.ganado, "COP")}</p>
          </div>
          {jornada && !bloqueada && (
            <Button type="button" variant="ghost" size="icon" onClick={borrar} disabled={pendiente} aria-label="Borrar jornada"><Trash2 className="size-4" /></Button>
          )}
          <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
          {!bloqueada && <Button type="button" onClick={guardar} disabled={pendiente}>{pendiente && <Loader2 className="size-4 animate-spin" />} Guardar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botón "Nuevo empleado": al crearlo abre su ficha. */
export function BotonNuevoEmpleado() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setAbierto(true)}><UserPlus className="size-4" /> Nuevo empleado</Button>
      {abierto && <DialogoEmpleado onCerrar={() => setAbierto(false)} alCrear={(id) => router.push(`/nomina/${id}`)} />}
    </>
  );
}
