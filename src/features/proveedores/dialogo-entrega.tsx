"use client";
import { useMemo } from "react";
import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { calcularEntrega, MODOS_COMPRA, NOMBRE_MODO, type ModoCompra } from "@/lib/calculos/entregas";
import { formatearCantidad, formatearMonto, parsearMonto } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { guardarEntrega } from "./acciones";
import { esquemaEntrega } from "./esquemas";
import { SubirFoto } from "./subir-foto";

export type Rubro = {
  id: number; codigo: number; nombre: string; emoji: string | null; categoria: string;
  modo_pesaje: string; kg_por_cesta: number | null; unidad: string;
};
export type EntregaEditable = {
  id: number; fecha: string; producto_id: number; moneda: string; modo_pesaje: string; kg_por_cesta: number | null;
  cestas: number; kg_total: number; unidades: number; precio: number; merma: number; foto_url: string | null; foto_path: string | null;
  nota: string | null; foto_firmada?: string | null; tiene_cestas?: boolean;
};

const num = (v: unknown) => (typeof v === "number" ? v : parsearMonto(String(v ?? ""))?.toNumber() ?? 0);
const vacio0 = (n: number) => (n ? n : "");

export function DialogoEntrega({
  proveedorId, rubros, monedas, monedaPorDefecto, hoy, entrega, onCerrar,
}: {
  proveedorId: number; rubros: Rubro[]; monedas: string[]; monedaPorDefecto: string; hoy: string;
  entrega?: EntregaEditable; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaEntrega,
    entrega
      ? {
          id: entrega.id, proveedor_id: proveedorId, fecha: entrega.fecha, producto_id: entrega.producto_id, moneda: entrega.moneda,
          modo_pesaje: entrega.modo_pesaje as ModoCompra, cestas: vacio0(entrega.cestas), kg_total: vacio0(entrega.kg_total),
          unidades: vacio0(entrega.unidades), precio: entrega.precio, merma: vacio0(entrega.merma),
          foto_url: entrega.foto_url ?? "", foto_path: entrega.foto_path ?? "", nota: entrega.nota ?? "", anotar_cestas: entrega.tiene_cestas ?? false,
        }
      : {
          proveedor_id: proveedorId, fecha: hoy, producto_id: "", moneda: monedaPorDefecto, modo_pesaje: "KG",
          cestas: "", kg_total: "", unidades: "", precio: "", merma: "", foto_url: "", foto_path: "", nota: "", anotar_cestas: true,
        },
    guardarEntrega,
    onCerrar,
  );

  const productoId = Number(form.watch("producto_id"));
  const rubro = rubros.find((r) => r.id === productoId);
  const esInsumo = rubro?.categoria === "insumo";
  const modo = form.watch("modo_pesaje") as ModoCompra;
  const mismoProducto = entrega && entrega.producto_id === productoId;
  const kgPorCesta = mismoProducto && entrega.kg_por_cesta ? entrega.kg_por_cesta : rubro?.kg_por_cesta ?? null;
  const moneda = form.watch("moneda");
  const [cestas, kgTotal, unidades, precio, merma] = form.watch(["cestas", "kg_total", "unidades", "precio", "merma"]);
  const unidadTxt = esInsumo ? rubro?.unidad ?? "und" : "und";

  const calculo = useMemo(() => {
    try {
      if (!rubro || num(precio) <= 0) return null;
      return calcularEntrega({ modo, kgPorCesta, cestas: num(cestas), kgTotal: num(kgTotal), unidades: num(unidades), precio: num(precio), merma: num(merma) });
    } catch (e) {
      return e instanceof Error ? e.message : null;
    }
  }, [rubro, modo, kgPorCesta, cestas, kgTotal, unidades, precio, merma]);

  function elegirProducto(e: React.ChangeEvent<HTMLSelectElement>) {
    const r = rubros.find((x) => x.id === Number(e.target.value));
    if (r && !entrega) form.setValue("modo_pesaje", (r.modo_pesaje === "VARIABLE" ? "KG" : r.modo_pesaje) as ModoCompra);
  }

  const modosDisponibles = MODOS_COMPRA.filter((m) => !(esInsumo && m.valor === "FIJO"));
  const etiquetaPrecio = { KG: "Precio por kilo", UNIDAD: `Precio por ${unidadTxt === "und" ? "unidad" : unidadTxt}`, FIJO: "Precio por cesta", VARIABLE: "Precio total" }[modo];
  const registroProducto = form.register("producto_id");

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={entrega ? "Editar entrega" : "Nueva entrega"} descripcion="Lo que trae el proveedor. No suma al inventario."
      resumenPie={calculo && typeof calculo !== "string" ? (
        <p className="flex items-baseline justify-between gap-2 text-sm sm:justify-start">
          <span className="text-muted-foreground">Total a pagar</span>
          <b className="tabular text-base text-warning">{formatearMonto(calculo.total, moneda)}</b>
        </p>
      ) : undefined}>
      <CampoTexto etiqueta="Fecha" type="date" requerido error={err.fecha?.message} {...form.register("fecha")} />
      <CampoSelect etiqueta="Moneda" {...form.register("moneda")}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Producto" requerido className="sm:col-span-2" error={err.producto_id?.message}
        {...registroProducto} onChange={(e) => { registroProducto.onChange(e); elegirProducto(e); }}>
        <option value="">Elige qué trajo…</option>
        {["fruta", "insumo"].map((cat) => {
          const lista = rubros.filter((r) => r.categoria === cat);
          return lista.length ? (
            <optgroup key={cat} label={cat === "fruta" ? "Frutas" : "Insumos"}>
              {lista.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
            </optgroup>
          ) : null;
        })}
      </CampoSelect>

      {rubro && (
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>¿Cómo se compra?</Label>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Modo de compra">
              {(modo === "VARIABLE" ? [...modosDisponibles, { valor: "VARIABLE" as const, titulo: "Precio total", corto: "" }] : modosDisponibles).map((m) => (
                <button key={m.valor} type="button" role="radio" aria-checked={modo === m.valor}
                  onClick={() => form.setValue("modo_pesaje", m.valor, { shouldValidate: false })}
                  className={cn("rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors",
                    modo === m.valor ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {m.titulo}
                </button>
              ))}
            </div>
            {modo === "FIJO" && !kgPorCesta && (
              <p className="text-xs text-destructive">Este producto no tiene kg por cesta configurados en Catálogos.</p>
            )}
          </div>

          {modo === "KG" || modo === "VARIABLE" ? (
            <CampoTexto etiqueta="Kilos recibidos" requerido inputMode="decimal" placeholder="400" error={err.kg_total?.message} {...form.register("kg_total")} />
          ) : modo === "UNIDAD" ? (
            <CampoTexto etiqueta={`Cantidad (${unidadTxt})`} requerido inputMode="decimal" placeholder="80" error={err.unidades?.message} {...form.register("unidades")} />
          ) : (
            <CampoTexto etiqueta="Cestas" requerido inputMode="decimal" error={err.cestas?.message}
              ayuda={kgPorCesta ? `× ${formatearCantidad(kgPorCesta)} kg por cesta` : undefined} {...form.register("cestas")} />
          )}
          <CampoTexto etiqueta={`${etiquetaPrecio} (${moneda})`} requerido inputMode="decimal" error={err.precio?.message} {...form.register("precio")} />
          {!esInsumo && (
            <CampoTexto etiqueta={modo === "UNIDAD" ? "Unidades dañadas" : "Merma (kg)"} inputMode="decimal" error={err.merma?.message} {...form.register("merma")} />
          )}
          {!esInsumo && modo !== "FIJO" && (
            <CampoTexto etiqueta="Cestas (opcional)" inputMode="numeric" ayuda="Para el control de cestas" error={err.cestas?.message} {...form.register("cestas")} />
          )}

          <div className="rounded-xl border bg-muted/30 p-3 text-sm sm:col-span-2" aria-live="polite">
            {typeof calculo === "string" ? (
              <p className="text-destructive">{calculo}</p>
            ) : calculo ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                {modo === "UNIDAD" ? (
                  <>
                    <dt className="text-muted-foreground">Unidades pagadas</dt>
                    <dd className="tabular text-right">{formatearCantidad(num(unidades) - num(merma))} {unidadTxt}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted-foreground">Kg recibidos</dt><dd className="tabular text-right">{formatearCantidad(calculo.kgTotal)} kg</dd>
                    <dt className="text-muted-foreground">Peso neto</dt><dd className="tabular text-right">{formatearCantidad(calculo.pesoNeto)} kg</dd>
                  </>
                )}
                {calculo.descMerma.gt(0) && (
                  <><dt className="text-muted-foreground">Descuento {modo === "UNIDAD" ? "dañadas" : "merma"}</dt>
                    <dd className="tabular text-right text-destructive">−{formatearMonto(calculo.descMerma, moneda)}</dd></>
                )}
                <dt className="font-semibold">Total a pagar</dt><dd className="tabular text-right text-base font-bold text-warning">{formatearMonto(calculo.total, moneda)}</dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">Escribe la cantidad y el precio para ver el total.</p>
            )}
          </div>
        </>
      )}

      <SubirFoto
        proveedorId={proveedorId}
        ruta={form.getValues("foto_path") || null}
        url={form.getValues("foto_url") || null}
        vistaPrevia={entrega?.foto_firmada ?? null}
        onCambio={({ ruta, url }) => { form.setValue("foto_path", ruta ?? ""); form.setValue("foto_url", url ?? ""); }}
      />
      <CampoTexto etiqueta="Nota" className="sm:col-span-2" {...form.register("nota")} />
      {!esInsumo && (
        <Controller control={form.control} name="anotar_cestas" render={({ field }) => (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
            Anotar las cestas como entregadas por el proveedor
          </label>
        )} />
      )}
      {modo === "VARIABLE" && <p className="text-xs text-muted-foreground sm:col-span-2">{NOMBRE_MODO.VARIABLE}: el precio escrito es el total de la entrega.</p>}
    </DialogoFormulario>
  );
}
