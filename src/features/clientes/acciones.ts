"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import {
  esquemaCliente, esquemaEmpaque, esquemaFacturaExterna, esquemaPago,
  type DatosCliente, type DatosEmpaque, type DatosFacturaExterna, type DatosPago,
} from "./esquemas";

function refrescar(clienteId?: number) {
  revalidatePath("/clientes");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`, "layout");
}

// ---------------------------------------------------------------- Clientes
export async function guardarCliente(entrada: DatosCliente): Promise<Resultado<{ id: number }>> {
  const perfil = await exigirPerfil("gestionar_clientes");
  const v = esquemaCliente.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, numero, ...d } = v.data;
  const supabase = await crearClienteServidor();
  // El número lo asigna la BD; solo el admin puede fijarlo o cambiarlo
  const fila = { ...d, ...(perfil.rol === "admin" && numero ? { numero } : {}) };
  const { data, error } = id
    ? await supabase.from("clientes").update(fila).eq("id", id).select("id, numero").single()
    : await supabase.from("clientes").insert(fila).select("id, numero").single();
  if (error) {
    return error.code === "23505"
      ? fallo(`Ya existe un cliente con el número ${numero}.`, { numero: "Número en uso" })
      : fallo(mensajeErrorBD(error));
  }
  refrescar(data.id);
  return exito({ id: data.id }, id ? "Cliente actualizado." : `Cliente nº ${data.numero} creado.`);
}

export async function cambiarActivoCliente(id: number, activo: boolean): Promise<Resultado> {
  await exigirPerfil("gestionar_clientes");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("clientes").update({ activo }).eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(id);
  return exito(undefined, activo ? "Cliente activado." : "Cliente desactivado (conserva su historial).");
}

export async function eliminarCliente(id: number): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const supabase = await crearClienteServidor();
  const { error, count } = await supabase.from("clientes").delete({ count: "exact" }).eq("id", id);
  if (error) {
    return error.code === "23503"
      ? fallo("El cliente tiene facturas, pagos o empaques. Desactívalo en su lugar.")
      : fallo(mensajeErrorBD(error));
  }
  if (!count) return fallo("No se encontró el cliente (o no tienes permiso).");
  refrescar();
  return exito(undefined, "Cliente eliminado.");
}

// ---------------------------------------------------------------- Facturas externas / históricas
export async function guardarFacturaExterna(entrada: DatosFacturaExterna): Promise<Resultado> {
  await exigirPerfil("facturar");
  const v = esquemaFacturaExterna.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.rpc("editar_factura_externa", { p: { id, ...d } })
    : await supabase.rpc("registrar_factura_externa", { p: d });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(d.cliente_id);
  return exito(undefined, id ? "Factura actualizada." : `Factura ${d.numero_externo} registrada.`);
}

export async function anularFactura(id: number, motivo: string): Promise<Resultado> {
  await exigirPerfil("facturar");
  if (motivo.trim().length < 3) return fallo("Escribe el motivo de la anulación.");
  const supabase = await crearClienteServidor();
  const { data: f } = await supabase.from("facturas").select("cliente_id").eq("id", id).single();
  const { data, error } = await supabase.rpc("anular_factura", { p_id: id, p_motivo: motivo.trim() });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(f?.cliente_id);
  const liberado = Number((data as { saldo_a_favor_generado?: number } | null)?.saldo_a_favor_generado ?? 0);
  return exito(undefined, liberado > 0 ? "Factura anulada. Los pagos que tenía quedaron como saldo a favor del cliente." : "Factura anulada.");
}

// ---------------------------------------------------------------- Pagos
export async function registrarPago(entrada: DatosPago): Promise<Resultado<{ id: number; numero: number }>> {
  await exigirPerfil("cobrar");
  const v = esquemaPago.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  if (id) {
    const { error } = await supabase.rpc("editar_pago_cliente", {
      p_id: id,
      p: { fecha: d.fecha, monto: d.monto, metodo_id: d.metodo_id, referencia: d.referencia, nota: d.nota, aplicaciones: d.aplicaciones },
    });
    if (error) return fallo(mensajeErrorBD(error));
    refrescar(d.cliente_id);
    const { data: p } = await supabase.from("pagos_clientes").select("numero").eq("id", id).single();
    return exito({ id, numero: p?.numero ?? 0 }, "Pago actualizado.");
  }
  const { data, error } = await supabase.rpc("registrar_pago_cliente", { p: d });
  if (error) return fallo(mensajeErrorBD(error));
  const r = data as { id: number; numero: number; saldo_a_favor: number };
  refrescar(d.cliente_id);
  return exito(
    { id: r.id, numero: r.numero },
    Number(r.saldo_a_favor) > 0 ? `Pago registrado (recibo nº ${r.numero}). El excedente quedó como saldo a favor.` : `Pago registrado (recibo nº ${r.numero}).`,
  );
}

export async function eliminarPago(id: number): Promise<Resultado> {
  await exigirPerfil("cobrar");
  const supabase = await crearClienteServidor();
  const { data: p } = await supabase.from("pagos_clientes").select("cliente_id").eq("id", id).single();
  const { error } = await supabase.rpc("eliminar_pago_cliente", { p_id: id });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(p?.cliente_id);
  return exito(undefined, "Pago eliminado. Las facturas recalcularon su estado.");
}

export async function aplicarSaldoAFavor(facturaId: number): Promise<Resultado> {
  await exigirPerfil("cobrar");
  const supabase = await crearClienteServidor();
  const { data: f } = await supabase.from("facturas").select("cliente_id").eq("id", facturaId).single();
  const { data, error } = await supabase.rpc("aplicar_saldo_a_favor", { p_factura_id: facturaId, p_monto: null as unknown as number });
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(f?.cliente_id);
  return exito(undefined, `Se aplicaron ${Number(data ?? 0).toLocaleString("es-VE")} de saldo a favor a la factura.`);
}

// ---------------------------------------------------------------- Empaques
export async function guardarEmpaque(entrada: DatosEmpaque): Promise<Resultado> {
  await exigirPerfil("gestionar_clientes");
  const v = esquemaEmpaque.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("empaques_clientes").update(d).eq("id", id)
    : await supabase.from("empaques_clientes").insert(d);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(d.cliente_id);
  return exito(undefined, "Movimiento de cajas registrado.");
}

export async function eliminarEmpaque(id: number): Promise<Resultado> {
  await exigirPerfil("gestionar_clientes");
  const supabase = await crearClienteServidor();
  const { data: e } = await supabase.from("empaques_clientes").select("cliente_id").eq("id", id).single();
  const { error } = await supabase.from("empaques_clientes").delete().eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(e?.cliente_id);
  return exito(undefined, "Movimiento de cajas eliminado.");
}
