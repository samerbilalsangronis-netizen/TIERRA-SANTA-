"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { CampoTexto } from "@/components/comunes/campos";
import { guardarMetodoPago } from "./acciones";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { esquemaMetodoPago } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";
import { useFormulario } from "@/components/comunes/use-formulario";

export type MetodoPago = { id: number; nombre: string; activo: boolean; orden: number };

export function PanelMetodos({ metodos }: { metodos: MetodoPago[] }) {
  const [editando, setEditando] = useState<MetodoPago | "nuevo" | null>(null);
  const siguienteOrden = Math.max(0, ...metodos.map((m) => m.orden)) + 1;
  return (
    <>
      <ListaCatalogo
        tabla="metodos_pago" filas={metodos} clave={(m) => m.id} nombre={(m) => m.nombre}
        textoBusqueda={(m) => m.nombre} activo={(m) => m.activo}
        textoNuevo="Nuevo método" vacio="No hay métodos de pago" onNuevo={() => setEditando("nuevo")} onEditar={setEditando}
        columnas={[
          { titulo: "Orden", className: "w-20", celda: (m) => <span className="tabular text-muted-foreground">{m.orden}</span> },
          { titulo: "Método", celda: (m) => <span className="font-medium">{m.nombre}</span> },
          { titulo: "Estado", celda: (m) => <EtiquetaEstado activo={m.activo} /> },
        ]}
        tarjeta={(m) => <p className="font-medium">{m.nombre}</p>}
      />
      {editando && (
        <FormMetodo metodo={editando === "nuevo" ? null : editando} siguienteOrden={siguienteOrden} onCerrar={() => setEditando(null)} />
      )}
    </>
  );
}

function FormMetodo({ metodo, siguienteOrden, onCerrar }: { metodo: MetodoPago | null; siguienteOrden: number; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaMetodoPago, metodo ?? { nombre: "", activo: true, orden: siguienteOrden }, guardarMetodoPago, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={metodo ? `Editar ${metodo.nombre}` : "Nuevo método de pago"} descripcion="Efectivo, transferencia, Zelle, Bancolombia, pago móvil…">
      <CampoTexto etiqueta="Nombre" requerido error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Orden en las listas" inputMode="numeric" error={err.orden?.message} {...form.register("orden")} />
      <Controller control={form.control} name="activo" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm sm:col-span-2">
          Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
    </DialogoFormulario>
  );
}
