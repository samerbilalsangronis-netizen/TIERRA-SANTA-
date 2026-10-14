"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { CampoTexto } from "@/components/comunes/campos";
import { guardarUnidad } from "./acciones";
import { DialogoFormulario } from "./dialogo-formulario";
import { esquemaUnidad } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";
import { useFormularioCatalogo } from "./use-formulario";

export type Unidad = { codigo: string; nombre: string; plural: string; activa: boolean };

export function PanelUnidades({ unidades }: { unidades: Unidad[] }) {
  const [editando, setEditando] = useState<Unidad | "nuevo" | null>(null);
  return (
    <>
      <ListaCatalogo
        tabla="unidades" filas={unidades} clave={(u) => u.codigo} nombre={(u) => u.nombre}
        textoBusqueda={(u) => `${u.codigo} ${u.nombre} ${u.plural}`} activo={(u) => u.activa}
        textoNuevo="Nueva unidad" vacio="No hay unidades" onNuevo={() => setEditando("nuevo")} onEditar={setEditando}
        columnas={[
          { titulo: "Código", className: "w-28", celda: (u) => <span className="font-mono font-semibold">{u.codigo}</span> },
          { titulo: "Nombre", celda: (u) => u.nombre },
          { titulo: "Plural", celda: (u) => u.plural },
          { titulo: "Estado", celda: (u) => <EtiquetaEstado activo={u.activa} /> },
        ]}
        tarjeta={(u) => <p><span className="font-mono font-semibold">{u.codigo}</span> · {u.nombre} / {u.plural}</p>}
      />
      {editando && <FormUnidad unidad={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function FormUnidad({ unidad, onCerrar }: { unidad: Unidad | null; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormularioCatalogo(
    esquemaUnidad,
    unidad ? { ...unidad, nuevo: false } : { nuevo: true, codigo: "", nombre: "", plural: "", activa: true },
    guardarUnidad, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={unidad ? `Editar unidad ${unidad.codigo}` : "Nueva unidad"} descripcion="Ej.: kg, cesta, caja, bolsa, unidad.">
      <CampoTexto etiqueta="Código" requerido disabled={!!unidad} autoCapitalize="none" placeholder="cesta"
        ayuda={unidad ? "El código no se cambia." : "Corto, en minúsculas."} error={err.codigo?.message} {...form.register("codigo")} />
      <CampoTexto etiqueta="Nombre" requerido placeholder="cesta" error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Plural" requerido placeholder="cestas" error={err.plural?.message} {...form.register("plural")} />
      <Controller control={form.control} name="activa" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm">
          Activa <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
    </DialogoFormulario>
  );
}
