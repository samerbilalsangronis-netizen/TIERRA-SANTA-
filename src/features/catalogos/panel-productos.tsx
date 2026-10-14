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
import { esquemaProducto } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";

export type Producto = {
  id: number; codigo: number; nombre: string; emoji: string | null; unidad: string;
  tipo: "materia_prima" | "terminado" | "ambos"; categoria: string; modo_pesaje: string;
  kg_por_cesta: number | null; stock_minimo: number; activo: boolean; notas: string | null;
  fruta_id?: number | null; peso_kg?: number | null;
};
type Unidad = { codigo: string; nombre: string };
type Pestana = "vende" | "fruta" | "insumo";

export function textoCompra(p: { modo_pesaje: string; kg_por_cesta: number | null }) {
  const modo = p.modo_pesaje as ModoCompra;
  return modo === "FIJO" && p.kg_por_cesta ? `Por cesta · ${formatearCantidad(p.kg_por_cesta)} kg/cesta` : NOMBRE_MODO[modo] ?? modo;
}

/** En qué pestaña va cada producto: lo que se vende lleva código; lo que se compra, no. */
const pestanaDe = (p: Producto): Pestana => (p.categoria === "insumo" ? "insumo" : p.tipo === "materia_prima" ? "fruta" : "vende");

const PESTANAS: { valor: Pestana; titulo: string; nuevo: string; ayuda: string }[] = [
  { valor: "vende", titulo: "Se vende", nuevo: "Nuevo producto", ayuda: "Bolsas de pulpa: se facturan, se producen y llevan inventario. El código es el que se teclea al facturar." },
  { valor: "fruta", titulo: "Fruta de proveedores", nuevo: "Nueva fruta", ayuda: "La fruta que traen los proveedores. Solo aparece al registrar entregas." },
  { valor: "insumo", titulo: "Insumos", nuevo: "Nuevo insumo", ayuda: "Bolsas, etiquetas, envases… Se compran a proveedores; no se facturan." },
];

export function PanelProductos({ productos, unidades, abrirNuevo = false }: { productos: Producto[]; unidades: Unidad[]; abrirNuevo?: boolean }) {
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(abrirNuevo ? "nuevo" : null);
  const [pestana, setPestana] = useState<Pestana>("vende");
  const filas = productos.filter((p) => pestanaDe(p) === pestana);
  const frutas = productos.filter((p) => pestanaDe(p) === "fruta");
  const nombreFruta = new Map(frutas.map((f) => [f.id, f.nombre]));
  const p = PESTANAS.find((x) => x.valor === pestana)!;
  const conCodigo = pestana === "vende";

  return (
    <>
      <div className="mb-2 flex gap-1 rounded-xl border bg-card p-1 sm:w-fit" role="tablist" aria-label="Tipo de producto">
        {PESTANAS.map((x) => (
          <button key={x.valor} type="button" role="tab" aria-selected={pestana === x.valor} onClick={() => setPestana(x.valor)}
            className={cn("flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors sm:flex-none", pestana === x.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {x.valor === "fruta" ? <>Fruta<span className="hidden sm:inline"> de proveedores</span></> : x.titulo}{" "}
            <span className="opacity-70">({productos.filter((y) => pestanaDe(y) === x.valor).length})</span>
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{p.ayuda}</p>
      <ListaCatalogo
        key={pestana}
        tabla="productos"
        filas={filas}
        clave={(x) => x.id}
        nombre={(x) => x.nombre}
        textoBusqueda={(x) => (conCodigo ? `${x.codigo} ${x.nombre}` : x.nombre)}
        activo={(x) => x.activo}
        agruparPorLetra={!conCodigo}
        placeholder={conCodigo ? "Buscar por código o nombre…" : "Buscar por nombre…"}
        textoNuevo={p.nuevo}
        vacio="No hay productos"
        onNuevo={() => setEditando("nuevo")}
        onEditar={setEditando}
        columnas={conCodigo ? [
          { titulo: "Código", className: "w-20", celda: (x) => <span className="tabular font-mono text-base font-bold text-primary">{x.codigo}</span> },
          { titulo: "Producto", celda: (x) => <span className="font-medium">{x.emoji} {x.nombre}</span> },
          { titulo: "Sale de", celda: (x) => <span className="text-sm text-muted-foreground">{x.fruta_id ? nombreFruta.get(x.fruta_id) ?? "—" : "—"}</span> },
          { titulo: "Pulpa", className: "text-right", celda: (x) => <span className="tabular text-sm">{x.peso_kg ? `${formatearCantidad(x.peso_kg)} kg / ${x.unidad}` : "—"}</span> },
          { titulo: "Stock mínimo", className: "text-right", celda: (x) => x.stock_minimo ? <span className="tabular">{formatearCantidad(x.stock_minimo)} {x.unidad}</span> : <span className="text-muted-foreground">—</span> },
          { titulo: "Estado", celda: (x) => <EtiquetaEstado activo={x.activo} /> },
        ] : [
          { titulo: pestana === "fruta" ? "Fruta" : "Insumo", celda: (x) => <span className="font-medium">{x.emoji} {x.nombre}</span> },
          { titulo: "Se compra", celda: (x) => <span className="text-sm">{textoCompra(x)}</span> },
          { titulo: "Estado", celda: (x) => <EtiquetaEstado activo={x.activo} /> },
        ]}
        tarjeta={(x) => (
          <div className="flex items-center gap-3">
            {conCodigo
              ? <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 font-mono text-lg font-bold text-primary">{x.codigo}</span>
              : <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{x.emoji || "•"}</span>}
            <div className="min-w-0">
              <p className="truncate font-medium">{conCodigo ? `${x.emoji ?? ""} ` : ""}{x.nombre}</p>
              <p className="text-xs text-muted-foreground">{conCodigo ? `${x.unidad}${x.peso_kg ? ` · ${formatearCantidad(x.peso_kg)} kg de pulpa` : ""}` : textoCompra(x)}</p>
              {!x.activo && <Badge variant="outline" className="mt-1">Inactivo</Badge>}
            </div>
          </div>
        )}
      />
      {editando && (
        <FormProducto
          producto={editando === "nuevo" ? null : editando}
          pestana={editando === "nuevo" ? pestana : pestanaDe(editando)}
          productos={productos}
          frutas={frutas}
          unidades={unidades}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

/** Código libre: lo que se vende usa el menor número libre; lo que se compra, uno oculto desde 900. */
function codigoNuevo(productos: Producto[], pestana: Pestana) {
  const usados = new Set(productos.map((p) => p.codigo));
  let n = pestana === "vende" ? 1 : 901;
  while (usados.has(n)) n++;
  return n;
}

function FormProducto({ producto, pestana, productos, frutas, unidades, onCerrar }: {
  producto: Producto | null; pestana: Pestana; productos: Producto[]; frutas: Producto[]; unidades: Unidad[]; onCerrar: () => void;
}) {
  const vende = pestana === "vende";
  const esInsumo = pestana === "insumo";
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaProducto,
    producto
      ? {
          ...producto, categoria: producto.categoria as "fruta" | "insumo", modo_pesaje: producto.modo_pesaje as ModoCompra,
          kg_por_cesta: producto.kg_por_cesta ?? "", emoji: producto.emoji ?? "", notas: producto.notas ?? "",
          fruta_id: producto.fruta_id ?? "", peso_kg: producto.peso_kg ?? "",
        }
      : {
          codigo: codigoNuevo(productos, pestana), nombre: "", emoji: "",
          unidad: vende ? (unidades.some((u) => u.codigo === "bolsa") ? "bolsa" : "und") : esInsumo ? "und" : "kg",
          tipo: vende ? "terminado" : "materia_prima", categoria: esInsumo ? "insumo" : "fruta",
          modo_pesaje: esInsumo ? "UNIDAD" : "KG", kg_por_cesta: "", stock_minimo: 0, activo: true, notas: "",
          fruta_id: "", peso_kg: vende ? "0,8" : "",
        },
    guardarProducto,
    onCerrar,
  );
  const modo = form.watch("modo_pesaje");
  const titulo = producto ? `Editar ${vende ? `${producto.codigo} · ` : ""}${producto.nombre}` : PESTANAS.find((x) => x.valor === pestana)!.nuevo;

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar} titulo={titulo}
      descripcion={PESTANAS.find((x) => x.valor === pestana)!.ayuda}>
      {vende ? (
        <div className="grid grid-cols-[6rem_1fr_4.5rem] gap-3 sm:col-span-2">
          <CampoTexto etiqueta="Código" requerido inputMode="numeric" error={err.codigo?.message} {...form.register("codigo")} />
          <CampoTexto etiqueta="Nombre" requerido placeholder="Ej. Guanábana 800 g" error={err.nombre?.message} {...form.register("nombre")} />
          <CampoTexto etiqueta="Ícono" placeholder="🍓" error={err.emoji?.message} {...form.register("emoji")} />
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_4.5rem] gap-3 sm:col-span-2">
          <CampoTexto etiqueta="Nombre" requerido placeholder={esInsumo ? "Ej. Bolsa 800 g" : "Ej. Guanábana"} error={err.nombre?.message} {...form.register("nombre")} />
          <CampoTexto etiqueta="Ícono" placeholder={esInsumo ? "🛍️" : "🍓"} error={err.emoji?.message} {...form.register("emoji")} />
        </div>
      )}

      {vende && (
        <>
          <CampoSelect etiqueta="Sale de la fruta" {...form.register("fruta_id")} ayuda="Para el gráfico de pulpa por rubro.">
            <option value="">—</option>
            {frutas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </CampoSelect>
          <CampoTexto etiqueta="Kg de pulpa por unidad" inputMode="decimal" placeholder="0,8" error={err.peso_kg?.message} {...form.register("peso_kg")} />
          <CampoSelect etiqueta="Se cuenta en" {...form.register("unidad")}>
            {unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
          </CampoSelect>
          <CampoTexto etiqueta="Stock mínimo (alerta)" inputMode="decimal" error={err.stock_minimo?.message} {...form.register("stock_minimo")} />
        </>
      )}

      {!vende && (
        <>
          {esInsumo && (
            <CampoSelect etiqueta="Unidad" className="sm:col-span-2" {...form.register("unidad")}>
              {unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
            </CampoSelect>
          )}
          <CampoSelect etiqueta="Se compra" {...form.register("modo_pesaje")}
            ayuda={modo === "KG" ? "Kilos × precio por kilo." : modo === "UNIDAD" ? "Unidades × precio por unidad." : modo === "FIJO" ? "Cestas × precio por cesta." : "Se puede cambiar en cada entrega."}>
            <option value="KG">Por kilo</option>
            <option value="UNIDAD">Por unidad</option>
            <option value="FIJO">Por cesta</option>
            {producto?.modo_pesaje === "VARIABLE" && <option value="VARIABLE">Precio total (sistema anterior)</option>}
          </CampoSelect>
          {modo === "FIJO" ? (
            <CampoTexto etiqueta="Kg por cesta" inputMode="decimal" requerido error={err.kg_por_cesta?.message} {...form.register("kg_por_cesta")} />
          ) : <div className="hidden sm:block" />}
        </>
      )}

      <Controller control={form.control} name="activo" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm sm:col-span-2">
          Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
      <CampoArea etiqueta="Notas" rows={2} className="sm:col-span-2" {...form.register("notas")} />
    </DialogoFormulario>
  );
}
