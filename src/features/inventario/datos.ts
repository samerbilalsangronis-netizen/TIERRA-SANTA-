import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ProductoInventario = {
  id: number; codigo: number; nombre: string; emoji: string | null; unidad: string; stock_minimo: number; activo: boolean;
};
export type Ubicacion = { id: number; nombre: string; predeterminada: boolean; es_cuarto_frio: boolean };
export type FilaStock = ProductoInventario & {
  total: number; porUbicacion: Record<number, number>; indicador: "normal" | "bajo" | "agotado";
};

/** Productos que se venden (frutas, no materia prima) con su stock de producto terminado por ubicación. */
export async function cargarStock(): Promise<{ filas: FilaStock[]; ubicaciones: Ubicacion[] }> {
  const supabase = await crearClienteServidor();
  const [{ data: productos }, { data: existencias }, { data: ubicaciones }] = await Promise.all([
    supabase.from("productos").select("id, codigo, nombre, emoji, unidad, stock_minimo, activo")
      .eq("categoria", "fruta").neq("tipo", "materia_prima").order("codigo"),
    supabase.from("existencias").select("producto_id, ubicacion_id, cantidad").eq("forma", "PT").limit(10000),
    supabase.from("ubicaciones").select("id, nombre, predeterminada, es_cuarto_frio").eq("activa", true)
      .order("predeterminada", { ascending: false }).order("nombre"),
  ]);
  const porProducto = new Map<number, Record<number, number>>();
  for (const e of existencias ?? []) {
    const m = porProducto.get(e.producto_id) ?? {};
    m[e.ubicacion_id] = (m[e.ubicacion_id] ?? 0) + Number(e.cantidad);
    porProducto.set(e.producto_id, m);
  }
  const filas = (productos ?? []).map((p): FilaStock => {
    const porUbicacion = porProducto.get(p.id) ?? {};
    const total = Object.values(porUbicacion).reduce((a, x) => a + x, 0);
    const minimo = Number(p.stock_minimo);
    return {
      ...p, stock_minimo: minimo, total, porUbicacion,
      indicador: total <= 0 ? "agotado" : total < minimo ? "bajo" : "normal",
    };
  }).filter((f) => f.activo || f.total !== 0);
  return { filas, ubicaciones: ubicaciones ?? [] };
}

export const TIPOS_MOVIMIENTO: Record<string, { texto: string; clase: string }> = {
  produccion: { texto: "Producción", clase: "text-success" },
  venta: { texto: "Factura", clase: "text-sky-400" },
  reverso_venta: { texto: "Devolución de factura", clase: "text-sky-400" },
  merma: { texto: "Merma", clase: "text-destructive" },
  ajuste: { texto: "Ajuste por conteo", clase: "text-warning" },
  traslado_salida: { texto: "Traslado (sale)", clase: "text-muted-foreground" },
  traslado_entrada: { texto: "Traslado (entra)", clase: "text-muted-foreground" },
  inicial: { texto: "Saldo inicial", clase: "text-muted-foreground" },
  compra: { texto: "Compra", clase: "text-muted-foreground" },
  consumo_produccion: { texto: "Consumo", clase: "text-muted-foreground" },
};
