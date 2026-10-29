"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { guardarConcepto } from "@/features/gastos/acciones";
import { esquemaConcepto } from "@/features/gastos/esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";

export type ConceptoGasto = { id: number; nombre: string; categoria_id: number; unidad: string; activo: boolean; categoria: string };

/** Conceptos de gastos (Guantes, Benzoato, Gasolina…) agrupados por categoría. */
export function PanelConceptosGasto({ conceptos, categorias, unidades }: {
  conceptos: ConceptoGasto[]; categorias: { id: number; nombre: string }[]; unidades: { codigo: string; nombre: string }[];
}) {
  const [editando, setEditando] = useState<ConceptoGasto | "nuevo" | null>(null);
  return (
    <>
      <ListaCatalogo
        tabla="conceptos_gasto" filas={conceptos} clave={(c) => c.id} nombre={(c) => c.nombre}
        textoBusqueda={(c) => `${c.nombre} ${c.categoria}`} activo={(c) => c.activo}
        textoNuevo="Nuevo concepto" vacio="No hay conceptos" placeholder="Buscar concepto…"
        onNuevo={() => setEditando("nuevo")} onEditar={setEditando}
        columnas={[
          { titulo: "Concepto", celda: (c) => <span className="font-medium">{c.nombre}</span> },
          { titulo: "Categoría", celda: (c) => c.categoria },
          { titulo: "Unidad", celda: (c) => c.unidad },
          { titulo: "Estado", celda: (c) => <EtiquetaEstado activo={c.activo} /> },
        ]}
        tarjeta={(c) => (
          <div>
            <p className="font-medium">{c.nombre}</p>
            <p className="text-sm text-muted-foreground">{c.categoria} · {c.unidad}</p>
          </div>
        )}
      />
      {editando && <FormConcepto concepto={editando === "nuevo" ? null : editando} categorias={categorias} unidades={unidades} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function FormConcepto({ concepto, categorias, unidades, onCerrar }: {
  concepto: ConceptoGasto | null; categorias: { id: number; nombre: string }[]; unidades: { codigo: string; nombre: string }[]; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaConcepto,
    concepto ? { id: concepto.id, nombre: concepto.nombre, categoria_id: concepto.categoria_id, unidad: concepto.unidad, activo: concepto.activo }
      : { nombre: "", categoria_id: "", unidad: "und", activo: true },
    async (d) => { const r = await guardarConcepto(d); return r.ok ? { ...r, datos: undefined } : r; }, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={concepto ? `Editar ${concepto.nombre}` : "Nuevo concepto de gasto"} descripcion="Lo que se compra para la planta: guantes, aditivos, gasolina…">
      <CampoTexto etiqueta="Concepto" requerido placeholder="Detergente" error={err.nombre?.message} {...form.register("nombre")} />
      <CampoSelect etiqueta="Categoría" requerido error={err.categoria_id?.message} {...form.register("categoria_id")}>
        <option value="">Elige…</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Unidad" {...form.register("unidad")}>
        {unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre} ({u.codigo})</option>)}
      </CampoSelect>
      <Controller control={form.control} name="activo" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm">
          Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
      {concepto && <p className="text-xs text-muted-foreground sm:col-span-2">Cambiar el nombre o la categoría también se refleja en los gastos ya registrados.</p>}
    </DialogoFormulario>
  );
}
