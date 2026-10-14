"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import {
  esquemaAbono, esquemaCestas, esquemaEntrega, esquemaProveedor,
  type DatosAbono, type DatosCestas, type DatosEntrega, type DatosProveedor,
} from "./esquemas";

function refrescar(proveedorId?: number) {
  revalidatePath("/proveedores");
  if (proveedorId) revalidatePath(`/proveedores/${proveedorId}`);
}

export async function guardarProveedor(entrada: DatosProveedor): Promise<Resultado<{ id: number }>> {
  await exigirPerfil("gestionar_proveedores");
  const v = esquemaProveedor.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  const { data, error } = id
    ? await supabase.from("proveedores").update(d).eq("id", id).select("id").single()
    : await supabase.from("proveedores").insert(d).select("id").single();
  if (error) {
    return error.code === "23505"
      ? fallo("Ya existe un proveedor con ese nombre.", { nombre: "Nombre en uso" })
      : fallo(mensajeErrorBD(error));
  }
  refrescar(data.id);
  return exito({ id: data.id }, id ? "Proveedor actualizado." : `Proveedor ${d.nombre} creado.`);
}

export async function cambiarActivoProveedor(id: number, activo: boolean): Promise<Resultado> {
  await exigirPerfil("gestionar_proveedores");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proveedores").update({ activo }).eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(id);
  return exito(undefined, activo ? "Proveedor activado." : "Proveedor desactivado (conserva su historial).");
}

export async function eliminarProveedor(id: number): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const supabase = await crearClienteServidor();
  const { error, count } = await supabase.from("proveedores").delete({ count: "exact" }).eq("id", id);
  if (error) {
    return error.code === "23503"
      ? fallo("El proveedor tiene entregas, abonos o cestas registrados. Desactívalo en su lugar.")
      : fallo(mensajeErrorBD(error));
  }
  if (!count) return fallo("No se encontró el proveedor (o no tienes permiso).");
  refrescar();
  return exito(undefined, "Proveedor eliminado.");
}

// ---------------------------------------------------------------- Entregas
export async function guardarEntrega(entrada: DatosEntrega): Promise<Resultado> {
  await exigirPerfil("gestionar_proveedores");
  const v = esquemaEntrega.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, anotar_cestas, ...d } = v.data;
  const supabase = await crearClienteServidor();

  // Los kg por cesta se copian del producto (la entrega conserva su copia)
  const { data: prod } = await supabase.from("productos").select("kg_por_cesta").eq("id", d.producto_id).single();
  if (!prod) return fallo("Producto no encontrado.");
  if (d.modo_pesaje === "FIJO" && !prod.kg_por_cesta) {
    return fallo("Este producto no tiene kg por cesta configurados. Elige «Por kilo» o configúralo en Catálogos.");
  }
  // Solo se guarda la cantidad que corresponde al modo
  const fila = {
    ...d, precio: d.precio as number, kg_por_cesta: prod.kg_por_cesta,
    kg_total: d.modo_pesaje === "KG" || d.modo_pesaje === "VARIABLE" ? d.kg_total : 0,
    unidades: d.modo_pesaje === "UNIDAD" ? d.unidades : 0,
  };

  let entregaId = id;
  if (id) {
    const { data: anterior } = await supabase.from("entregas_proveedor").select("producto_id, kg_por_cesta").eq("id", id).single();
    // Al editar sin cambiar el producto se conservan sus kg por cesta originales
    const conservar = anterior && anterior.producto_id === d.producto_id && anterior.kg_por_cesta
      ? { kg_por_cesta: anterior.kg_por_cesta } : {};
    const { error } = await supabase.from("entregas_proveedor").update({ ...fila, ...conservar }).eq("id", id);
    if (error) return fallo(mensajeErrorBD(error));
  } else {
    const { data, error } = await supabase.from("entregas_proveedor").insert(fila).select("id").single();
    if (error) return fallo(mensajeErrorBD(error));
    entregaId = data.id;
  }

  // Cestas entregadas enlazadas a la entrega
  const { data: enlazada } = await supabase.from("cestas_proveedor").select("id").eq("entrega_id", entregaId!).maybeSingle();
  const cestas = Math.trunc(d.cestas);
  if (anotar_cestas && cestas > 0) {
    const mov = { proveedor_id: d.proveedor_id, fecha: d.fecha, entregadas: cestas, devueltas: 0, entrega_id: entregaId!, nota: "Con la entrega" };
    const { error } = enlazada
      ? await supabase.from("cestas_proveedor").update(mov).eq("id", enlazada.id)
      : await supabase.from("cestas_proveedor").insert(mov);
    if (error) return fallo(`La entrega se guardó, pero no las cestas: ${mensajeErrorBD(error)}`);
  } else if (enlazada) {
    await supabase.from("cestas_proveedor").delete().eq("id", enlazada.id);
  }

  refrescar(d.proveedor_id);
  return exito(undefined, id ? "Entrega actualizada." : "Entrega registrada.");
}

export async function eliminarEntrega(id: number): Promise<Resultado> {
  await exigirPerfil("pagar_proveedores");
  const supabase = await crearClienteServidor();
  const { data: e } = await supabase.from("entregas_proveedor").select("proveedor_id, foto_path").eq("id", id).single();
  if (!e) return fallo("Entrega no encontrada.");
  await supabase.from("cestas_proveedor").delete().eq("entrega_id", id);
  const { error } = await supabase.from("entregas_proveedor").delete().eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  if (e.foto_path) await supabase.storage.from("entregas").remove([e.foto_path]);
  refrescar(e.proveedor_id);
  return exito(undefined, "Entrega eliminada.");
}

// ---------------------------------------------------------------- Abonos
export async function guardarAbono(entrada: DatosAbono): Promise<Resultado> {
  await exigirPerfil("pagar_proveedores");
  const v = esquemaAbono.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const fila = { ...d, monto: d.monto as number };
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("abonos_proveedor").update(fila).eq("id", id)
    : await supabase.from("abonos_proveedor").insert(fila);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(d.proveedor_id);
  return exito(undefined, id ? "Abono actualizado." : "Abono registrado.");
}

export async function eliminarAbono(id: number): Promise<Resultado> {
  await exigirPerfil("pagar_proveedores");
  const supabase = await crearClienteServidor();
  const { data: a } = await supabase.from("abonos_proveedor").select("proveedor_id").eq("id", id).single();
  if (!a) return fallo("Abono no encontrado.");
  const { error } = await supabase.from("abonos_proveedor").delete().eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(a.proveedor_id);
  return exito(undefined, "Abono eliminado.");
}

// ---------------------------------------------------------------- Cestas
export async function guardarCestas(entrada: DatosCestas): Promise<Resultado> {
  await exigirPerfil("gestionar_proveedores");
  const v = esquemaCestas.safeParse(entrada);
  if (!v.success) return fallo("Revisa los campos marcados.", erroresZod(v.error));
  const { id, ...d } = v.data;
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("cestas_proveedor").update(d).eq("id", id)
    : await supabase.from("cestas_proveedor").insert(d);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(d.proveedor_id);
  return exito(undefined, "Cestas registradas.");
}

export async function eliminarCestas(id: number): Promise<Resultado> {
  await exigirPerfil("pagar_proveedores");
  const supabase = await crearClienteServidor();
  const { data: c } = await supabase.from("cestas_proveedor").select("proveedor_id").eq("id", id).single();
  if (!c) return fallo("Registro no encontrado.");
  const { error } = await supabase.from("cestas_proveedor").delete().eq("id", id);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar(c.proveedor_id);
  return exito(undefined, "Registro de cestas eliminado.");
}
