"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import { formatearCantidad } from "@/lib/dinero";
import { esquemaFactura, type DatosFactura } from "./esquemas";

type Advertencia = { producto: string; disponible: number; requerido: number };
export type ResultadoFactura = { id: number; numero: number | null; advertencias: string[] };

function refrescar(clienteId?: number | null, facturaId?: number) {
  revalidatePath("/facturacion");
  if (facturaId) revalidatePath(`/facturacion/${facturaId}`);
  revalidatePath("/clientes");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`, "layout");
}

const textoAdvertencias = (adv: Advertencia[] | null | undefined) =>
  (adv ?? []).map((a) => `${a.producto}: había ${formatearCantidad(a.disponible)} y se facturaron ${formatearCantidad(a.requerido)}`);

/** Emitir, guardar como borrador o editar una factura (todo en una transacción en la BD). */
export async function guardarFactura(entrada: DatosFactura): Promise<Resultado<ResultadoFactura>> {
  await exigirPerfil("facturar");
  const v = esquemaFactura.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const d = v.data;
  const supabase = await crearClienteServidor();
  const p = {
    ...(d.id ? { id: d.id } : {}),
    cliente_id: d.cliente_id, fecha: d.fecha, moneda: d.moneda, condicion: d.condicion,
    ubicacion_id: d.ubicacion_id, observaciones: d.observaciones ?? "", iva_pct: d.iva_pct,
    lineas: d.lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio_unitario: l.precio_unitario, aplica_iva: l.aplica_iva })),
  };

  if (d.modo === "borrador") {
    const { data, error } = await supabase.rpc("guardar_borrador_factura", { p });
    if (error) return fallo(mensajeErrorBD(error));
    refrescar(d.cliente_id, Number(data));
    return exito({ id: Number(data), numero: null, advertencias: [] }, "Borrador guardado. No afecta inventario ni saldos.");
  }

  if (d.modo === "editar") {
    if (!d.id) return fallo("Factura no indicada.");
    const { data: antes } = await supabase.from("facturas").select("cliente_id").eq("id", d.id).single();
    const { data, error } = await supabase.rpc("editar_factura", {
      p: { ...p, motivo: d.motivo ?? "", ...(d.tasa_conversion ? { tasa_conversion: d.tasa_conversion } : {}) },
    });
    if (error) return fallo(mensajeErrorBD(error));
    const r = data as { id: number; numero: number; advertencias: Advertencia[]; pagos_convertidos?: number };
    refrescar(antes?.cliente_id, d.id);
    if (antes?.cliente_id && antes.cliente_id !== d.cliente_id) refrescar(d.cliente_id);
    const extra = Number(r.pagos_convertidos ?? 0) > 0 ? " Los pagos se convirtieron a la nueva moneda." : "";
    return exito({ id: d.id, numero: r.numero, advertencias: textoAdvertencias(r.advertencias) }, `Factura actualizada (mismo número).${extra}`);
  }

  const monto = d.pago.monto ?? 0;
  const { data, error } = await supabase.rpc("emitir_factura", {
    p: {
      ...p,
      ...(d.cajas > 0 ? { empaques: { retiradas: d.cajas } } : {}),
      ...(monto > 0 ? { pago: { monto, metodo_id: d.pago.metodo_id, referencia: d.pago.referencia ?? null } } : {}),
    },
  });
  if (error) return fallo(mensajeErrorBD(error));
  const r = data as { id: number; numero: number; advertencias: Advertencia[] };
  refrescar(d.cliente_id, r.id);
  return exito({ id: r.id, numero: r.numero, advertencias: textoAdvertencias(r.advertencias) }, "Factura emitida.");
}

/** Anular una factura emitida, o descartar un borrador. */
export async function anularFacturaSistema(id: number, motivo: string): Promise<Resultado<{ borrador: boolean }>> {
  await exigirPerfil("facturar");
  const supabase = await crearClienteServidor();
  const { data: f } = await supabase.from("facturas").select("cliente_id, estado").eq("id", id).single();
  if (!f) return fallo("Factura no encontrada.");
  const borrador = f.estado === "borrador";
  if (!borrador && motivo.trim().length < 3) return fallo("Escribe el motivo de la anulación.");
  const { error } = await supabase.rpc("anular_factura", { p_id: id, p_motivo: borrador ? "Borrador descartado" : motivo.trim() });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(f.cliente_id, id);
  return exito({ borrador }, borrador ? "Borrador descartado." : "Factura anulada. El inventario se devolvió y lo pagado pasó a sus otras facturas pendientes.");
}

/** Últimos precios usados con un cliente en una moneda: { producto_id: precio }. */
export async function ultimosPrecios(clienteId: number, moneda: string): Promise<Record<number, number>> {
  await exigirPerfil("facturar");
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("ultimos_precios_cliente", { p_cliente_id: clienteId, p_moneda: moneda });
  return Object.fromEntries((data ?? []).map((r) => [r.producto_id, Number(r.precio)]));
}

/** Datos de un cliente (para el que se acaba de crear desde la factura). */
export async function datosCliente(id: number) {
  await exigirPerfil("facturar");
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("clientes").select("id, numero, nombre, documento, telefono, direccion").eq("id", id).maybeSingle();
  return data;
}
