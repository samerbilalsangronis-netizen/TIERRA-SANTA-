import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";
import { numeroFactura } from "@/lib/facturas";
import { cargarDatosFormulario, cargarFactura } from "@/features/facturacion/datos";
import { FormularioFactura } from "@/features/facturacion/formulario-factura";

export const metadata: Metadata = { title: "Editar factura" };

/** Editar una factura emitida (mismo número) o continuar un borrador. */
export default async function PaginaEditarFactura({ params }: PageProps<"/facturacion/[id]/editar">) {
  const perfil = await exigirPerfil("facturar");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const supabase = await crearClienteServidor();
  const [factura, datos, { data: puede }, { data: movimientos }] = await Promise.all([
    cargarFactura(id),
    cargarDatosFormulario(),
    supabase.rpc("puede_editar_facturas"),
    supabase.from("movimientos_inventario").select("producto_id, ubicacion_id, cantidad").eq("factura_id", id),
  ]);
  if (!factura || factura.origen !== "sistema") notFound();
  if (factura.estado === "anulada") redirect(`/facturacion/${id}`);
  if (factura.estado === "emitida" && !puede) redirect(`/facturacion/${id}?sinpermiso=1`);

  // Lo que esta factura ya descontó vuelve a estar disponible mientras se edita
  const devolver: Record<number, number> = {};
  for (const m of movimientos ?? []) {
    if (m.ubicacion_id === factura.ubicacion_id) devolver[m.producto_id] = (devolver[m.producto_id] ?? 0) - Number(m.cantidad);
  }
  // Productos ya facturados que hoy estén inactivos siguen disponibles en esta factura
  const faltan = factura.factura_lineas.filter((l) => !datos.productos.some((p) => p.id === l.producto_id));
  for (const l of faltan) {
    if (!datos.productos.some((p) => p.id === l.producto_id)) datos.productos.push({ id: l.producto_id, codigo: l.codigo, nombre: l.descripcion, unidad: l.unidad, emoji: null });
  }
  if (!datos.clientes.some((c) => c.id === factura.cliente_id)) {
    datos.clientes.push({ id: factura.cliente_id, numero: factura.cliente_numero ?? 0, nombre: factura.cliente_nombre ?? "", documento: factura.cliente_documento, telefono: factura.cliente_telefono, direccion: factura.cliente_direccion });
  }

  return (
    <FormularioFactura datos={datos} hoy={hoyISO()} esAdmin={perfil.rol === "admin"}
      modo={factura.estado === "borrador" ? "borrador" : "editar"}
      numero={numeroFactura(factura, datos.empresa.factura_prefijo)}
      pagadoActual={Number(factura.pagado)} devolver={devolver}
      inicial={{
        id: factura.id, cliente_id: factura.cliente_id, fecha: factura.fecha, moneda: factura.moneda, condicion: factura.condicion,
        ubicacion_id: factura.ubicacion_id, observaciones: factura.observaciones ?? "", iva_pct: Number(factura.iva_pct),
        lineas: factura.factura_lineas.map((l) => ({ producto_id: l.producto_id, cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario), aplica_iva: l.aplica_iva })),
      }} />
  );
}
