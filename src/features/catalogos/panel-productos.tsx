"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { formatearCantidad } from "@/lib/dinero";
import { NOMBRE_MODO, type ModoCompra } from "@/lib/calculos/entregas";
import { cn } from "@/lib/utils";
import { guardarProducto } from "./acciones";
import { esquemaProducto, TIPOS_PRODUCTO } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";

export type Producto = {
  id: number; codigo: number; nombre: string; emoji: string | null; unidad: string;
  tipo: "materia_prima" | "terminado" | "ambos"; categoria: string; modo_pesaje: string;
  kg_por_cesta: number | null; stock_minimo: number; activo: boolean; notas: string | null;
};
type Unidad = { codigo: string; nombre: string };

const NOMBRE_TIPO = Object.fromEntries(TIPOS_PRODUCTO) as Record<Producto["tipo"], string>;

export function textoCompra(p: { modo_pesaje: string; kg_por_cesta: number | null }) {
  const modo = p.modo_pesaje as ModoCompra;
  return modo === "FIJO" && p.kg_por_cesta ? `Por cesta · ${formatearCantidad(p.kg_por_cesta)} kg/cesta` : NOMBRE_MODO[modo] ?? modo;
}

export function PanelProductos({ productos, unidades }: { productos: Producto[]; unidades: Unidad[] }) {
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);
  const [categoria, setCategoria] = useState<"todas" | "fruta" | "insumo">("todas");
  const siguienteCodigo = Math.max(0, ...productos.map((p) => p.codigo)) + 1;
  const filas = categoria === "todas" ? productos : productos.filter((p) => p.categoria === categoria);
  return (
    <>
      <div className="mb-3 flex gap-1.5">
        {([["todas", "Todos"], ["fruta", "Frutas / pulpas"], ["insumo", "Insumos (bolsas, etiquetas…)"]] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => setCategoria(v)}
            className={cn("rounded-full border px-3 py-1 text-xs", categoria === v ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>
      <ListaCatalogo
        tabla="productos"
        filas={filas}
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
          { titulo: "Producto", celda: (p) => (
            <span className="font-medium">{p.emoji} {p.nombre} {p.categoria === "insumo" && <Badge variant="outline" className="ml-1">Insumo</Badge>}</span>) },
          { titulo: "Unidad", celda: (p) => p.unidad },
          { titulo: "Tipo", celda: (p) => <span className="text-sm text-muted-foreground">{p.categoria === "insumo" ? "—" : NOMBRE_TIPO[p.tipo]}</span> },
          { titulo: "Se compra", celda: (p) => <span className="text-sm">{textoCompra(p)}</span> },
          { titulo: "Stock mínimo", className: "text-right", celda: (p) => p.categoria === "insumo" ? "—" : <span className="tabular">{formatearCantidad(p.stock_minimo)} {p.unidad}</span> },
          { titulo: "Estado", celda: (p) => <EtiquetaEstado activo={p.activo} /> },
        ]}
        tarjeta={(p) => (
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 font-mono text-lg font-bold text-primary">{p.codigo}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{p.emoji} {p.nombre}</p>
              <p className="text-xs text-muted-foreground">{p.categoria === "insumo" ? "Insumo · " : `${p.unidad} · `}{textoCompra(p)}</p>
              {!p.activo && <Badge variant="outline" className="mt-1">Inactivo</Badge>}
            </div>
          </div>
        )}
      />
      {editando && (
        <FormProducto
          producto={editando === "nuevo" ? null : editando}
          categoriaNueva={categoria === "insumo" ? "insumo" : "fruta"}
          siguienteCodigo={siguienteCodigo}
          unidades={unidades}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function FormProducto({ producto, categoriaNueva, siguienteCodigo, unidades, onCerrar }: {
  producto: Producto | null; categoriaNueva: "fruta" | "insumo"; siguienteCodigo: number; unidades: Unidad[]; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaProducto,
    producto
      ? {
          ...producto, categoria: producto.categoria as "fruta" | "insumo", modo_pesaje: producto.modo_pesaje as ModoCompra,
          kg_por_cesta: producto.kg_por_cesta ?? "", emoji: producto.emoji ?? "", notas: producto.notas ?? "",
        }
      : {
          codigo: siguienteCodigo, nombre: "", emoji: "", unidad: categoriaNueva === "insumo" ? "und" : "kg",
          tipo: categoriaNueva === "insumo" ? "materia_prima" : "ambos", categoria: categoriaNueva,
          modo_pesaje: categoriaNueva === "insumo" ? "UNIDAD" : "KG", kg_por_cesta: "", stock_minimo: 0, activo: true, notas: "",
        },
    guardarProducto,
    onCerrar,
  );
  const categoria = form.watch("categoria");
  const modo = form.watch("modo_pesaje");
  const esInsumo = categoria === "insumo";
  return (
    <DialogoFormulario
      abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={producto ? `Editar ${producto.codigo} · ${producto.nombre}` : esInsumo ? "Nuevo insumo" : "Nuevo producto"}
      descripcion={esInsumo ? "Bolsas, etiquetas, envases… Se compran a proveedores; no se facturan." : "El código es el número que se teclea en la factura (1 = Guanábana, 2 = Parchita…)."}
    >
      <CampoSelect etiqueta="Categoría" className="sm:col-span-2" {...form.register("categoria")}>
        <option value="fruta">Fruta / pulpa</option>
        <option value="insumo">Insumo (bolsas, etiquetas, envases…)</option>
      </CampoSelect>
      <div className="grid grid-cols-[6rem_1fr_4.5rem] gap-3 sm:col-span-2">
        <CampoTexto etiqueta="Código" requerido inputMode="numeric" error={err.codigo?.message} {...form.register("codigo")} />
        <CampoTexto etiqueta="Nombre" requerido error={err.nombre?.message} {...form.register("nombre")} />
        <CampoTexto etiqueta="Ícono" placeholder={esInsumo ? "🛍️" : "🍓"} error={err.emoji?.message} {...form.register("emoji")} />
      </div>
      <CampoSelect etiqueta={esInsumo ? "Unidad" : "Unidad de venta / stock"} {...form.register("unidad")}>
        {unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre} ({u.codigo})</option>)}
      </CampoSelect>
      {!esInsumo ? (
        <CampoSelect etiqueta="Tipo" {...form.register("tipo")}>
          {TIPOS_PRODUCTO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
      ) : <div className="hidden sm:block" />}

      <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground sm:col-span-2">
        Cómo se le compra al proveedor (se puede cambiar en cada entrega). Lo que trae el proveedor <b>no suma al inventario</b>.
      </p>
      <CampoSelect etiqueta="Se compra" {...form.register("modo_pesaje")}
        ayuda={modo === "KG" ? "Kilos × precio por kilo." : modo === "UNIDAD" ? "Unidades × precio por unidad." : modo === "FIJO" ? "Cestas × precio por cesta." : undefined}>
        <option value="KG">Por kilo</option>
        <option value="UNIDAD">Por unidad</option>
        <option value="FIJO">Por cesta</option>
        {producto?.modo_pesaje === "VARIABLE" && <option value="VARIABLE">Precio total (sistema anterior)</option>}
      </CampoSelect>
      {modo === "FIJO" ? (
        <CampoTexto etiqueta="Kg por cesta" inputMode="decimal" requerido error={err.kg_por_cesta?.message} {...form.register("kg_por_cesta")} />
      ) : <div className="hidden sm:block" />}

      {!esInsumo && (
        <CampoTexto etiqueta="Stock mínimo (alerta)" inputMode="decimal" error={err.stock_minimo?.message} {...form.register("stock_minimo")} />
      )}
      <Controller control={form.control} name="activo" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm">
          Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
      <CampoArea etiqueta="Notas" rows={2} className="sm:col-span-2" {...form.register("notas")} />
    </DialogoFormulario>
  );
}
