"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Snowflake, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CampoTexto } from "@/components/comunes/campos";
import { guardarUbicacion } from "./acciones";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { esquemaUbicacion } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";
import { useFormulario } from "@/components/comunes/use-formulario";

export type Ubicacion = { id: number; nombre: string; descripcion: string | null; es_cuarto_frio: boolean; predeterminada: boolean; activa: boolean };

function Marcas({ u }: { u: Ubicacion }) {
  return (
    <span className="inline-flex gap-1">
      {u.predeterminada && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary"><Star className="size-3" /> Predeterminada</Badge>}
      {u.es_cuarto_frio && <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-400"><Snowflake className="size-3" /> Cuarto frío</Badge>}
    </span>
  );
}

export function PanelUbicaciones({ ubicaciones }: { ubicaciones: Ubicacion[] }) {
  const [editando, setEditando] = useState<Ubicacion | "nuevo" | null>(null);
  return (
    <>
      <ListaCatalogo
        tabla="ubicaciones" filas={ubicaciones} clave={(u) => u.id} nombre={(u) => u.nombre}
        textoBusqueda={(u) => `${u.nombre} ${u.descripcion ?? ""}`} activo={(u) => u.activa}
        textoNuevo="Nueva ubicación" vacio="No hay ubicaciones" onNuevo={() => setEditando("nuevo")} onEditar={setEditando}
        columnas={[
          { titulo: "Ubicación", celda: (u) => <span className="font-medium">{u.nombre}</span> },
          { titulo: "Descripción", celda: (u) => <span className="text-sm text-muted-foreground">{u.descripcion ?? "—"}</span> },
          { titulo: "", celda: (u) => <Marcas u={u} /> },
          { titulo: "Estado", celda: (u) => <EtiquetaEstado activo={u.activa} /> },
        ]}
        tarjeta={(u) => (
          <div className="space-y-1">
            <p className="font-medium">{u.nombre}</p>
            {u.descripcion && <p className="text-xs text-muted-foreground">{u.descripcion}</p>}
            <Marcas u={u} />
          </div>
        )}
      />
      {editando && <FormUbicacion ubicacion={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function FormUbicacion({ ubicacion, onCerrar }: { ubicacion: Ubicacion | null; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaUbicacion,
    ubicacion ? { ...ubicacion, descripcion: ubicacion.descripcion ?? "" } : { nombre: "", descripcion: "", es_cuarto_frio: false, predeterminada: false, activa: true },
    guardarUbicacion, onCerrar,
  );
  const interruptor = (name: "es_cuarto_frio" | "predeterminada" | "activa", texto: string, ayuda?: string) => (
    <Controller control={form.control} name={name} render={({ field }) => (
      <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm sm:col-span-2">
        <span>{texto}{ayuda && <span className="block text-xs text-muted-foreground">{ayuda}</span>}</span>
        <Switch checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
      </label>
    )} />
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={ubicacion ? `Editar ${ubicacion.nombre}` : "Nueva ubicación"} descripcion="Planta, galpón, otra sede, cuartos fríos…">
      <CampoTexto etiqueta="Nombre" requerido className="sm:col-span-2" error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Descripción" className="sm:col-span-2" {...form.register("descripcion")} />
      {interruptor("es_cuarto_frio", "Es cuarto frío")}
      {interruptor("predeterminada", "Ubicación predeterminada", "Se usa por defecto en facturas y producción. Solo puede haber una.")}
      {interruptor("activa", "Activa")}
    </DialogoFormulario>
  );
}
