"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import { formatearCantidad } from "@/lib/dinero";
import { esquemaMovimiento, esquemaProduccion, type DatosMovimiento, type DatosProduccion } from "./esquemas";

function refrescar(productoId?: number) {
  revalidatePath("/inventario");
  if (productoId) revalidatePath(`/inventario/${productoId}`);
  revalidatePath("/dashboard");
}

export async function registrarProduccion(entrada: DatosProduccion): Promise<Resultado<{ id: number }>> {
  await exigirPerfil("inventario_operar");
  const v = esquemaProduccion.safeParse(entrada);
  if (!v.success) return fallo(v.error.issues[0]?.message ?? "Revisa los campos.", erroresZod(v.error));
  const d = v.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("registrar_produccion", {
    p_fecha: d.fecha, p_ubicacion_id: d.ubicacion_id, p_items: d.items, p_responsable: d.responsable ?? undefined, p_nota: d.nota ?? undefined,
  });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  const n = d.items.length;
  return exito({ id: Number(data) }, `Producción registrada: ${n} producto${n === 1 ? "" : "s"}.`);
}

export async function registrarMovimiento(entrada: DatosMovimiento): Promise<Resultado> {
  const v = esquemaMovimiento.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const d = v.data;
  await exigirPerfil(d.tipo === "ajuste" ? "inventario_ajustar" : "inventario_operar");
  const supabase = await crearClienteServidor();
  if (d.tipo === "merma") {
    const { error } = await supabase.rpc("registrar_merma_inventario", {
      p_producto_id: d.producto_id, p_ubicacion_id: d.ubicacion_id, p_forma: "PT", p_cantidad: d.cantidad!, p_motivo: d.motivo,
    });
    if (error) return fallo(mensajeErrorBD(error));
    refrescar(d.producto_id);
    return exito(undefined, `Merma registrada: ${formatearCantidad(d.cantidad!)} menos en el inventario.`);
  }
  if (d.tipo === "traslado") {
    if (d.ubicacion_id === d.destino_id) return fallo("El origen y el destino deben ser distintos.", { destino_id: "Elige otro destino" });
    const { error } = await supabase.rpc("trasladar_inventario", {
      p_producto_id: d.producto_id, p_forma: "PT", p_origen: d.ubicacion_id, p_destino: d.destino_id, p_cantidad: d.cantidad!, p_nota: d.motivo ?? undefined,
    });
    if (error) return fallo(mensajeErrorBD(error));
    refrescar(d.producto_id);
    return exito(undefined, "Traslado registrado.");
  }
  const { data, error } = await supabase.rpc("ajustar_inventario", {
    p_producto_id: d.producto_id, p_ubicacion_id: d.ubicacion_id, p_forma: "PT", p_conteo: d.conteo!, p_motivo: d.motivo,
  });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(d.producto_id);
  const dif = Number(data ?? 0);
  return exito(undefined, dif === 0 ? "El conteo coincide: no hubo cambios." : `Ajuste registrado (${dif > 0 ? "+" : ""}${formatearCantidad(dif)}).`);
}

export async function eliminarProduccion(id: number, motivo: string): Promise<Resultado> {
  await exigirPerfil("inventario_ajustar");
  if (motivo.trim().length < 3) return fallo("Escribe el motivo.");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("eliminar_produccion", { p_id: id, p_motivo: motivo.trim() });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, "Producción eliminada. El stock volvió a como estaba.");
}
