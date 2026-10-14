"use server";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { exigirPerfil } from "@/lib/auth/sesion";
import { erroresZod, exito, fallo, mensajeErrorBD, type Resultado } from "@/lib/acciones";
import {
  esquemaMetodoPago, esquemaMoneda, esquemaProducto, esquemaTarea, esquemaTasa, esquemaUbicacion, esquemaUnidad,
  type DatosMetodoPago, type DatosMoneda, type DatosProducto, type DatosTarea, type DatosTasa,
  type DatosUbicacion, type DatosUnidad,
} from "./esquemas";

type Tabla = "productos" | "unidades" | "ubicaciones" | "monedas" | "tasas_cambio" | "metodos_pago" | "tareas_nomina";
const CLAVE: Record<Tabla, "id" | "codigo"> = {
  productos: "id", unidades: "codigo", ubicaciones: "id", monedas: "codigo",
  tasas_cambio: "id", metodos_pago: "id", tareas_nomina: "id",
};
const COLUMNA_ACTIVO: Partial<Record<Tabla, "activo" | "activa">> = {
  productos: "activo", unidades: "activa", ubicaciones: "activa", monedas: "activa", metodos_pago: "activo", tareas_nomina: "activa",
};

function refrescar() {
  revalidatePath("/configuracion/catalogos", "layout");
}

function validar<S extends z.ZodType>(esquema: S, datos: unknown): { ok: true; datos: z.output<S> } | { ok: false; r: Resultado<never> } {
  const v = esquema.safeParse(datos);
  return v.success ? { ok: true, datos: v.data } : { ok: false, r: fallo("Revisa los campos marcados.", erroresZod(v.error)) };
}

function errorGuardado(error: { code?: string; message?: string }, duplicado: Record<string, string>): Resultado<never> {
  if (error.code === "23505") {
    const [campo, msg] = Object.entries(duplicado)[0];
    return fallo(msg, { [campo]: msg });
  }
  return fallo(mensajeErrorBD(error));
}

export async function guardarProducto(entrada: DatosProducto): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaProducto, entrada);
  if (!v.ok) return v.r;
  const { id, ...d } = v.datos;
  const fila = { ...d, codigo: d.codigo as number, kg_por_cesta: d.kg_por_cesta };
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("productos").update(fila).eq("id", id)
    : await supabase.from("productos").insert(fila);
  if (error) {
    if (error.code === "23505") {
      return error.message.includes("codigo")
        ? fallo(`Ya existe un producto con el código ${fila.codigo}.`, { codigo: "Código en uso" })
        : fallo("Ya existe un producto con ese nombre.", { nombre: "Nombre en uso" });
    }
    return fallo(mensajeErrorBD(error));
  }
  refrescar();
  return exito(undefined, id ? "Producto actualizado." : `Producto ${fila.codigo} · ${fila.nombre} creado.`);
}

export async function guardarUnidad(entrada: DatosUnidad): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaUnidad, entrada);
  if (!v.ok) return v.r;
  const { nuevo, ...d } = v.datos;
  const supabase = await crearClienteServidor();
  const { error } = nuevo
    ? await supabase.from("unidades").insert(d)
    : await supabase.from("unidades").update({ nombre: d.nombre, plural: d.plural, activa: d.activa }).eq("codigo", d.codigo);
  if (error) return errorGuardado(error, { codigo: "Ya existe esa unidad." });
  refrescar();
  return exito(undefined, "Unidad guardada.");
}

export async function guardarUbicacion(entrada: DatosUbicacion): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaUbicacion, entrada);
  if (!v.ok) return v.r;
  const { id, ...d } = v.datos;
  if (d.predeterminada && !d.activa) return fallo("La ubicación predeterminada debe estar activa.");
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("ubicaciones").update(d).eq("id", id)
    : await supabase.from("ubicaciones").insert(d);
  if (error) return errorGuardado(error, { nombre: "Ya existe una ubicación con ese nombre." });
  refrescar();
  return exito(undefined, "Ubicación guardada.");
}

export async function guardarMoneda(entrada: DatosMoneda): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaMoneda, entrada);
  if (!v.ok) return v.r;
  const { nuevo, ...d } = v.datos;
  const supabase = await crearClienteServidor();
  if (!d.activa) {
    const { data: e } = await supabase.from("empresa").select("moneda_defecto").eq("id", 1).single();
    if (e?.moneda_defecto === d.codigo) return fallo("No puedes desactivar la moneda por defecto de la empresa.");
  }
  const fila = { ...d, decimales: d.decimales as number };
  const { error } = nuevo
    ? await supabase.from("monedas").insert(fila)
    : await supabase.from("monedas").update(fila).eq("codigo", d.codigo);
  if (error) return errorGuardado(error, { codigo: "Ya existe esa moneda." });
  refrescar();
  return exito(undefined, "Moneda guardada.");
}

export async function guardarTasa(entrada: DatosTasa): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaTasa, entrada);
  if (!v.ok) return v.r;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tasas_cambio").upsert(
    { ...v.datos, tasa: v.datos.tasa as number },
    { onConflict: "fecha,moneda_origen,moneda_destino" },
  );
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, "Tasa registrada.");
}

export async function guardarMetodoPago(entrada: DatosMetodoPago): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaMetodoPago, entrada);
  if (!v.ok) return v.r;
  const { id, ...d } = v.datos;
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("metodos_pago").update(d).eq("id", id)
    : await supabase.from("metodos_pago").insert(d);
  if (error) return errorGuardado(error, { nombre: "Ya existe ese método de pago." });
  refrescar();
  return exito(undefined, "Método de pago guardado.");
}

export async function guardarTarea(entrada: DatosTarea): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const v = validar(esquemaTarea, entrada);
  if (!v.ok) return v.r;
  const { id, ...d } = v.datos;
  const fila = { ...d, valor: d.valor as number };
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("tareas_nomina").update(fila).eq("id", id)
    : await supabase.from("tareas_nomina").insert(fila);
  if (error) return errorGuardado(error, { nombre: "Ya existe una tarea con ese nombre." });
  refrescar();
  return exito(undefined, id ? "Tarea actualizada. El nuevo precio aplica a las jornadas que se registren desde ahora." : "Tarea creada.");
}

export async function cambiarActivo(tabla: Tabla, clave: string | number, activo: boolean): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const col = COLUMNA_ACTIVO[tabla];
  if (!col) return fallo("Este catálogo no se puede desactivar.");
  const supabase = await crearClienteServidor();
  if (!activo && tabla === "monedas") {
    const { data: e } = await supabase.from("empresa").select("moneda_defecto").eq("id", 1).single();
    if (e?.moneda_defecto === clave) return fallo("No puedes desactivar la moneda por defecto de la empresa.");
  }
  if (!activo && tabla === "ubicaciones") {
    const { data: u } = await supabase.from("ubicaciones").select("predeterminada").eq("id", Number(clave)).single();
    if (u?.predeterminada) return fallo("Marca otra ubicación como predeterminada antes de desactivar esta.");
  }
  const { error } = await supabase.from(tabla).update({ [col]: activo } as never).eq(CLAVE[tabla] as never, clave as never);
  if (error) return fallo(mensajeErrorBD(error));
  refrescar();
  return exito(undefined, activo ? "Activado." : "Desactivado. Ya no aparecerá en las listas para elegir, pero conserva su historial.");
}

/** Borra solo si no tiene historial; si lo tiene, sugiere desactivar. */
export async function eliminarDeCatalogo(tabla: Tabla, clave: string | number): Promise<Resultado> {
  await exigirPerfil("configuracion");
  const supabase = await crearClienteServidor();
  if (tabla === "ubicaciones") {
    const { data: u } = await supabase.from("ubicaciones").select("predeterminada").eq("id", Number(clave)).single();
    if (u?.predeterminada) return fallo("No puedes eliminar la ubicación predeterminada.");
  }
  if (tabla === "monedas") {
    const { data: e } = await supabase.from("empresa").select("moneda_defecto").eq("id", 1).single();
    if (e?.moneda_defecto === clave) return fallo("No puedes eliminar la moneda por defecto de la empresa.");
  }
  const { error, count } = await supabase.from(tabla).delete({ count: "exact" }).eq(CLAVE[tabla] as never, clave as never);
  if (error) {
    return error.code === "23503"
      ? fallo(COLUMNA_ACTIVO[tabla]
          ? "No se puede eliminar porque ya se usó en registros. Desactívalo en su lugar."
          : "No se puede eliminar porque ya se usó en registros.")
      : fallo(mensajeErrorBD(error));
  }
  if (!count) return fallo("No se encontró el registro (o no tienes permiso).");
  refrescar();
  return exito(undefined, "Eliminado.");
}
