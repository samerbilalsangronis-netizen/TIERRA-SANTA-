"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { formatearCantidad } from "@/lib/dinero";
import { guardarProducto } from "./acciones";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { esquemaProducto, TIPOS_PRODUCTO } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";
import { useFormulario } from "@/components/comunes/use-formulario";

export type Producto = {
  id: number; codigo: number; nombre: string; emoji: string | null; unidad: string;
  tipo: "materia_prima" | "terminado" | "ambos"; modo_pesaje: "FIJO" | "VARIABLE";
  kg_por_cesta: number | null; stock_minimo: number; activo: boolean; notas: string | null;
};
type Unidad = { codigo: string; nombre: string };

const NOMBRE_TIPO = Object.fromEntries(TIPOS_PRODUCTO) as Record<Producto["tipo"], string>;

export function PanelProductos({ productos, unidades }: { productos: Producto[]; unidades: Unidad[] }) {
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);
  const siguienteCodigo = Math.max(0, ...productos.map((p) => p.codigo)) + 1;
  return (
    <>
      <ListaCatalogo
        tabla="productos"
        filas={productos}
        clave={(p) => p.id}
        nombre={(p) => p.nombre}
        textoBusqueda={(p) => `${p.codigo} ${p.nombre}`}
        activo={(p) => p.activo}
        placeholder="Buscar por código o nombre…"
        textoNuevo="Nuevo producto"
        vacio="No hay productos"
        onNuevo={() => setEditando("nuevo")}
        onEditar={setEditando}
        columnas={[
          { titulo: "Código", className: "w-20", celda: (p) => <span className="tabular font-mono text-base font-bold text-primary">{p.codigo}</span> },
          { titulo: "Producto", celda: (p) => <span className="font-medium">{p.emoji} {p.nombre}</span> },
          { titulo: "Unidad", celda: (p) => p.unidad },
          { titulo: "Tipo", celda: (p) => <span className="text-sm text-muted-foreground">{NOMBRE_TIPO[p.tipo]}</span> },
          { titulo: "Compra a proveedores", celda: (p) => p.tipo === "terminado" ? "—" : (
            <span className="text-sm">{p.modo_pesaje}{p.modo_pesaje === "FIJO" && p.kg_por_cesta ? ` · ${formatearCantidad(p.kg_por_cesta)} kg/cesta` : ""}</span>) },
          { titulo: "Stock mínimo", className: "text-right", celda: (p) => <span className="tabular">{formatearCantidad(p.stock_minimo)} {p.unidad}</span> },
          { titulo: "Estado", celda: (p) => <EtiquetaEstado activo={p.activo} /> },
        ]}
        tarjeta={(p) => (
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 font-mono text-lg font-bold text-primary">{p.codigo}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{p.emoji} {p.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {p.unidad} · {p.tipo === "terminado" ? "Pulpa" : `${p.modo_pesaje}${p.modo_pesaje === "FIJO" && p.kg_por_cesta ? ` ${formatearCantidad(p.kg_por_cesta)} kg/cesta` : ""}`}
              </p>
              {!p.activo && <Badge variant="outline" className="mt-1">Inactivo</Badge>}
            </div>
          </div>
        )}
      />
      {editando && (
        <FormProducto
          producto={editando === "nuevo" ? null : editando}
          siguienteCodigo={siguienteCodigo}
          unidades={unidades}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function FormProducto({ producto, siguienteCodigo, unidades, onCerrar }: {
  producto: Producto | null; siguienteCodigo: number; unidades: Unidad[]; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaProducto,
    producto
      ? { ...producto, kg_por_cesta: producto.kg_por_cesta ?? "", emoji: producto.emoji ?? "", notas: producto.notas ?? "" }
      : { codigo: siguienteCodigo, nombre: "", emoji: "", unidad: "kg", tipo: "ambos", modo_pesaje: "FIJO", kg_por_cesta: "", stock_minimo: 0, activo: true, notas: "" },
    guardarProducto,
    onCerrar,
  );
  const tipo = form.watch("tipo");
  const modo = form.watch("modo_pesaje");
  return (
    <DialogoFormulario
      abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={producto ? `Editar ${producto.codigo} · ${producto.nombre}` : "Nuevo producto"}
      descripcion="El código es el número que se teclea en la factura (1 = Guanábana, 2 = Parchita…)."
    >
      <div className="grid grid-cols-[6rem_1fr_4.5rem] gap-3 sm:col-span-2">
        <CampoTexto etiqueta="Código" requerido inputMode="numeric" error={err.codigo?.message} {...form.register("codigo")} />
        <CampoTexto etiqueta="Nombre" requerido error={err.nombre?.message} {...form.register("nombre")} />
        <CampoTexto etiqueta="Ícono" placeholder="🍓" error={err.emoji?.message} {...form.register("emoji")} />
      </div>
      <CampoSelect etiqueta="Unidad de venta / stock" {...form.register("unidad")}>
        {unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre} ({u.codigo})</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Tipo" {...form.register("tipo")}>
        {TIPOS_PRODUCTO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </CampoSelect>
      {tipo !== "terminado" && (
        <>
          <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground sm:col-span-2">
            Solo para calcular cuánto se le paga al proveedor. Lo que trae el proveedor <b>no suma al inventario</b>:
            el inventario sube con las entradas de producción.
          </p>
          <CampoSelect etiqueta="Pesaje en entregas de proveedores" {...form.register("modo_pesaje")}
            ayuda={modo === "FIJO" ? "kg = cestas × kg por cesta; el precio es por cesta." : "Se escribe el total de kg; el precio es el total de la entrega."}>
            <option value="FIJO">FIJO (por cesta)</option>
            <option value="VARIABLE">VARIABLE (kg total)</option>
          </CampoSelect>
          <CampoTexto etiqueta="Kg por cesta" inputMode="decimal" disabled={modo !== "FIJO"} requerido={modo === "FIJO"}
            error={err.kg_por_cesta?.message} {...form.register("kg_por_cesta")} />
        </>
      )}
      <CampoTexto etiqueta="Stock mínimo (alerta)" inputMode="decimal" error={err.stock_minimo?.message} {...form.register("stock_minimo")} />
      <Controller control={form.control} name="activo" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm">
          Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
      <CampoArea etiqueta="Notas" rows={2} className="sm:col-span-2" {...form.register("notas")} />
      {producto && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Cambiar el pesaje o los kg por cesta solo afecta a las entregas nuevas: las anteriores conservan su configuración.
        </p>
      )}
    </DialogoFormulario>
  );
}
