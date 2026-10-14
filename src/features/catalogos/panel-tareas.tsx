"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { CampoTexto } from "@/components/comunes/campos";
import { formatearMonto } from "@/lib/dinero";
import { guardarTarea } from "./acciones";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { esquemaTarea } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";
import { useFormulario } from "@/components/comunes/use-formulario";

export type Tarea = { id: number; emoji: string | null; nombre: string; valor: number; unidad: string; activa: boolean; orden: number };

export function PanelTareas({ tareas }: { tareas: Tarea[] }) {
  const [editando, setEditando] = useState<Tarea | "nuevo" | null>(null);
  const siguienteOrden = Math.max(0, ...tareas.map((t) => t.orden)) + 1;
  return (
    <>
      <ListaCatalogo
        tabla="tareas_nomina" filas={tareas} clave={(t) => t.id} nombre={(t) => t.nombre}
        textoBusqueda={(t) => `${t.nombre} ${t.unidad}`} activo={(t) => t.activa}
        textoNuevo="Nueva tarea" vacio="No hay tareas" placeholder="Buscar tarea…"
        onNuevo={() => setEditando("nuevo")} onEditar={setEditando}
        columnas={[
          { titulo: "Tarea", celda: (t) => <span className="font-medium">{t.emoji} {t.nombre}</span> },
          { titulo: "Precio", className: "text-right", celda: (t) => (
            <span className="tabular font-semibold text-warning">{formatearMonto(t.valor, "COP", { sinCodigo: true })} / {t.unidad}</span>) },
          { titulo: "Estado", celda: (t) => <EtiquetaEstado activo={t.activa} /> },
        ]}
        tarjeta={(t) => (
          <div>
            <p className="font-medium">{t.emoji} {t.nombre}</p>
            <p className="tabular text-sm font-semibold text-warning">{formatearMonto(t.valor, "COP", { sinCodigo: true })} / {t.unidad}</p>
          </div>
        )}
      />
      {editando && <FormTarea tarea={editando === "nuevo" ? null : editando} siguienteOrden={siguienteOrden} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function FormTarea({ tarea, siguienteOrden, onCerrar }: { tarea: Tarea | null; siguienteOrden: number; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaTarea,
    tarea ? { ...tarea, emoji: tarea.emoji ?? "" } : { emoji: "", nombre: "", valor: "", unidad: "cesta", activa: true, orden: siguienteOrden },
    guardarTarea, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={tarea ? `Editar ${tarea.nombre}` : "Nueva tarea de nómina"}
      descripcion="Lo que se paga a los empleados por tarea (destajo). Ej.: Despulpar Fresa — $2.000 por cesta.">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3 sm:col-span-2">
        <CampoTexto etiqueta="Ícono" placeholder="🍓" {...form.register("emoji")} />
        <CampoTexto etiqueta="Tarea" requerido placeholder="Despulpar Fresa" error={err.nombre?.message} {...form.register("nombre")} />
      </div>
      <CampoTexto etiqueta="Precio (COP)" requerido inputMode="decimal" placeholder="2.000" error={err.valor?.message} {...form.register("valor")} />
      <CampoTexto etiqueta="Por cada" requerido placeholder="cesta" error={err.unidad?.message} {...form.register("unidad")} />
      <CampoTexto etiqueta="Orden en la jornada" inputMode="numeric" {...form.register("orden")} />
      <Controller control={form.control} name="activa" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm">
          Activa <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
      {tarea && <p className="text-xs text-muted-foreground sm:col-span-2">Cambiar el precio no altera las jornadas ya registradas.</p>}
    </DialogoFormulario>
  );
}
