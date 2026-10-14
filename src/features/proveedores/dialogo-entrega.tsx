"use client";
import { useMemo } from "react";
import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { calcularEntrega } from "@/lib/calculos/entregas";
import { formatearCantidad, formatearMonto, parsearMonto } from "@/lib/dinero";
import { guardarEntrega } from "./acciones";
import { esquemaEntrega } from "./esquemas";
import { SubirFoto } from "./subir-foto";

export type Rubro = { id: number; codigo: number; nombre: string; emoji: string | null; modo_pesaje: "FIJO" | "VARIABLE"; kg_por_cesta: number | null };
export type EntregaEditable = {
  id: number; fecha: string; producto_id: number; moneda: string; modo_pesaje: "FIJO" | "VARIABLE"; kg_por_cesta: number | null;
  cestas: number; kg_total: number; precio: number; merma: number; foto_url: string | null; foto_path: string | null;
  nota: string | null; foto_firmada?: string | null; tiene_cestas?: boolean;
};

const num = (v: unknown) => (typeof v === "number" ? v : parsearMonto(String(v ?? ""))?.toNumber() ?? 0);

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
          modo_pesaje: entrega.modo_pesaje, cestas: entrega.cestas || "", kg_total: entrega.kg_total || "", precio: entrega.precio,
          merma: entrega.merma || "", foto_url: entrega.foto_url ?? "", foto_path: entrega.foto_path ?? "", nota: entrega.nota ?? "",
          anotar_cestas: entrega.tiene_cestas ?? false,
        }
      : {
          proveedor_id: proveedorId, fecha: hoy, producto_id: "", moneda: monedaPorDefecto, modo_pesaje: "FIJO",
          cestas: "", kg_total: "", precio: "", merma: "", foto_url: "", foto_path: "", nota: "", anotar_cestas: true,
        },
    guardarEntrega,
    onCerrar,
  );

  const productoId = Number(form.watch("producto_id"));
  const rubro = rubros.find((r) => r.id === productoId);
  // Si se edita sin cambiar el rubro, se usa la configuración guardada en la entrega
  const mismoRubro = entrega && entrega.producto_id === productoId;
  const modo = mismoRubro ? entrega.modo_pesaje : rubro?.modo_pesaje ?? "FIJO";
  const kgPorCesta = mismoRubro ? entrega.kg_por_cesta : rubro?.kg_por_cesta ?? null;
  const moneda = form.watch("moneda");
  const [cestas, kgTotal, precio, merma] = form.watch(["cestas", "kg_total", "precio", "merma"]);

  const calculo = useMemo(() => {
    try {
      if (!rubro || num(precio) <= 0) return null;
      return calcularEntrega({ modo, kgPorCesta, cestas: num(cestas), kgTotal: num(kgTotal), precio: num(precio), merma: num(merma) });
    } catch (e) {
      return e instanceof Error ? e.message : null;
    }
  }, [rubro, modo, kgPorCesta, cestas, kgTotal, precio, merma]);

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={(e) => { form.setValue("modo_pesaje", modo); return enviar(e); }}
      titulo={entrega ? "Editar entrega" : "Nueva entrega"} descripcion="Fruta recibida del proveedor. No suma al inventario.">
      <CampoTexto etiqueta="Fecha" type="date" requerido error={err.fecha?.message} {...form.register("fecha")} />
      <CampoSelect etiqueta="Moneda" {...form.register("moneda")}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Rubro" requerido className="sm:col-span-2" error={err.producto_id?.message} {...form.register("producto_id")}>
        <option value="">Elige la fruta…</option>
        {rubros.map((r) => (
          <option key={r.id} value={r.id}>
            {r.codigo} · {r.emoji} {r.nombre} — {r.modo_pesaje === "FIJO" ? `FIJO ${formatearCantidad(r.kg_por_cesta)} kg/cesta` : "VARIABLE"}
          </option>
        ))}
      </CampoSelect>

      {rubro && (
        <>
          <CampoTexto etiqueta="Cestas" requerido={modo === "FIJO"} inputMode="decimal" error={err.cestas?.message}
            ayuda={modo === "FIJO" ? `× ${formatearCantidad(kgPorCesta)} kg por cesta` : "Opcional (para el control de cestas)"} {...form.register("cestas")} />
          {modo === "VARIABLE" ? (
            <CampoTexto etiqueta="Kg total" requerido inputMode="decimal" error={err.kg_total?.message} {...form.register("kg_total")} />
          ) : <div className="hidden sm:block" />}
          <CampoTexto etiqueta={modo === "FIJO" ? `Precio por cesta (${moneda})` : `Precio total (${moneda})`} requerido inputMode="decimal"
            error={err.precio?.message} {...form.register("precio")} />
          <CampoTexto etiqueta="Merma (kg)" inputMode="decimal" error={err.merma?.message} {...form.register("merma")} />

          <div className="rounded-xl border bg-muted/30 p-3 text-sm sm:col-span-2" aria-live="polite">
            {typeof calculo === "string" ? (
              <p className="text-destructive">{calculo}</p>
            ) : calculo ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Kg total</dt><dd className="tabular text-right">{formatearCantidad(calculo.kgTotal)} kg</dd>
                <dt className="text-muted-foreground">Peso neto</dt><dd className="tabular text-right">{formatearCantidad(calculo.pesoNeto)} kg</dd>
                <dt className="text-muted-foreground">Precio por kg</dt><dd className="tabular text-right">{formatearMonto(calculo.precioKg.toDecimalPlaces(2), moneda)}</dd>
                <dt className="text-muted-foreground">Descuento merma</dt><dd className="tabular text-right text-destructive">−{formatearMonto(calculo.descMerma, moneda)}</dd>
                <dt className="font-semibold">Total a pagar</dt><dd className="tabular text-right text-base font-bold text-warning">{formatearMonto(calculo.total, moneda)}</dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">Escribe cestas/kg y precio para ver el total.</p>
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
      <Controller control={form.control} name="anotar_cestas" render={({ field }) => (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          Anotar estas cestas como entregadas por el proveedor
        </label>
      )} />
    </DialogoFormulario>
  );
}
