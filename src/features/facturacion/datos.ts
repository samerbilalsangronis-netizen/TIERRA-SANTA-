import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ClienteFactura = {
  id: number; numero: number; nombre: string; documento: string | null; telefono: string | null; direccion: string | null;
};
export type ProductoFactura = { id: number; codigo: number; nombre: string; unidad: string; emoji: string | null };
/** Existencias disponibles para vender: { ubicacion_id: { producto_id: cantidad } } */
export type StockPorUbicacion = Record<number, Record<number, number>>;

export type DatosFormularioFactura = {
  clientes: ClienteFactura[];
  productos: ProductoFactura[];
  stock: StockPorUbicacion;
  ubicaciones: { id: number; nombre: string; predeterminada: boolean }[];
  monedas: string[];
  metodos: { id: number; nombre: string }[];
  empresa: {
    iva_pct: number; moneda_defecto: string; stock_insuficiente: string; cambio_moneda_con_pagos: string;
    titulo_documento: string; factura_prefijo: string;
    /** Desde cuándo las facturas descuentan inventario (null = todavía no). */
    inventario_desde: string | null;
  };
};

/** Todo lo que necesita la pantalla de emisión (una sola ida a la BD, en paralelo). */
export async function cargarDatosFormulario(): Promise<DatosFormularioFactura> {
  const supabase = await crearClienteServidor();
  const [{ data: clientes }, { data: productos }, { data: existencias }, { data: ubicaciones }, { data: monedas }, { data: metodos }, { data: empresa }] =
    await Promise.all([
      supabase.from("clientes").select("id, numero, nombre, documento, telefono, direccion").eq("activo", true).order("nombre").limit(5000),
      supabase.from("productos").select("id, codigo, nombre, unidad, emoji, tipo").eq("activo", true).eq("categoria", "fruta").neq("tipo", "materia_prima").order("codigo"),
      supabase.from("existencias").select("producto_id, ubicacion_id, forma, cantidad").eq("forma", "PT").neq("cantidad", 0).limit(10000),
      supabase.from("ubicaciones").select("id, nombre, predeterminada").eq("activa", true).order("predeterminada", { ascending: false }).order("nombre"),
      supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
      supabase.from("metodos_pago").select("id, nombre").eq("activo", true).order("orden"),
      supabase.from("empresa").select("iva_pct, moneda_defecto, stock_insuficiente, cambio_moneda_con_pagos, titulo_documento, factura_prefijo, inventario_desde").eq("id", 1).single(),
    ]);
  const stock: StockPorUbicacion = {};
  for (const e of existencias ?? []) {
    const u = (stock[e.ubicacion_id] ??= {});
    u[e.producto_id] = (u[e.producto_id] ?? 0) + Number(e.cantidad);
  }
  return {
    clientes: (clientes ?? []).map((c) => ({ ...c, numero: c.numero ?? 0 })),
    productos: (productos ?? []).map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, unidad: p.unidad, emoji: p.emoji })),
    stock,
    ubicaciones: ubicaciones ?? [],
    monedas: (monedas ?? []).map((m) => m.codigo),
    metodos: metodos ?? [],
    empresa: {
      iva_pct: Number(empresa?.iva_pct ?? 16), moneda_defecto: empresa?.moneda_defecto ?? "USD",
      stock_insuficiente: empresa?.stock_insuficiente ?? "advertir", cambio_moneda_con_pagos: empresa?.cambio_moneda_con_pagos ?? "convertir",
      titulo_documento: empresa?.titulo_documento ?? "Factura", factura_prefijo: empresa?.factura_prefijo ?? "",
      inventario_desde: empresa?.inventario_desde ?? null,
    },
  };
}

const COLUMNAS_FACTURA =
  "id, origen, numero, numero_externo, estado, estado_pago, cliente_id, fecha, moneda, condicion, ubicacion_id, observaciones, iva_pct, " +
  "cliente_numero, cliente_nombre, cliente_documento, cliente_telefono, cliente_direccion, base_imponible, exento, subtotal, iva, total, pagado, saldo, " +
  "motivo_anulacion, anulada_el, version, emitida_el, created_at, " +
  "factura_lineas(id, orden, producto_id, codigo, descripcion, unidad, cantidad, precio_unitario, aplica_iva, total_linea)";

export type FacturaCompleta = {
  id: number; origen: string; numero: number | null; numero_externo: string | null; estado: "borrador" | "emitida" | "anulada";
  estado_pago: string; cliente_id: number; fecha: string; moneda: string; condicion: "contado" | "credito";
  ubicacion_id: number | null; observaciones: string | null; iva_pct: number;
  cliente_numero: number | null; cliente_nombre: string | null; cliente_documento: string | null; cliente_telefono: string | null; cliente_direccion: string | null;
  base_imponible: number; exento: number; subtotal: number; iva: number; total: number; pagado: number; saldo: number;
  motivo_anulacion: string | null; anulada_el: string | null; version: number; emitida_el: string | null; created_at: string;
  factura_lineas: { id: number; orden: number; producto_id: number; codigo: number; descripcion: string; unidad: string;
    cantidad: number; precio_unitario: number; aplica_iva: boolean; total_linea: number }[];
};

export async function cargarFactura(id: number): Promise<FacturaCompleta | null> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("facturas").select(COLUMNAS_FACTURA).eq("id", id).maybeSingle();
  if (!data) return null;
  const f = data as unknown as FacturaCompleta;
  f.factura_lineas = [...f.factura_lineas].sort((a, b) => a.orden - b.orden || a.id - b.id);
  return f;
}

export async function cargarEmpresaDocumento() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("empresa")
    .select("razon_social, rif, direccion, telefonos, correo, logo_path, titulo_documento, factura_prefijo, pie_factura, texto_legal")
    .eq("id", 1).single();
  return data;
}
export type EmpresaDocumento = NonNullable<Awaited<ReturnType<typeof cargarEmpresaDocumento>>>;
