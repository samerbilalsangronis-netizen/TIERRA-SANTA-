import "server-only";
import { leerTodos, leerPagina } from "@/lib/paginacion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Categoria = { id: number; nombre: string; orden: number; activa: boolean };
export type Concepto = { id: number; nombre: string; categoria_id: number; unidad: string; activo: boolean };
export type CatalogoGastos = {
  categorias: Categoria[]; conceptos: Concepto[]; unidades: { codigo: string; nombre: string }[];
  monedas: string[]; metodos: { id: number; nombre: string }[]; monedaDefecto: string;
};

/** Categorías, conceptos y listas para el formulario de gastos. */
export async function cargarCatalogoGastos(): Promise<CatalogoGastos> {
  const supabase = await crearClienteServidor();
  const [{ data: categorias }, { data: conceptos }, { data: unidades }, { data: monedas }, { data: metodos }, { data: empresa }] = await Promise.all([
    supabase.from("categorias_gasto").select("id, nombre, orden, activa").order("orden").order("nombre"),
    supabase.from("conceptos_gasto").select("id, nombre, categoria_id, unidad, activo").order("nombre"),
    supabase.from("unidades").select("codigo, nombre").eq("activa", true).order("nombre"),
    supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
    supabase.from("metodos_pago").select("id, nombre").eq("activo", true).order("orden"),
    supabase.from("empresa").select("moneda_defecto").eq("id", 1).single(),
  ]);
  const lista = (monedas ?? []).map((m) => m.codigo);
  return {
    categorias: categorias ?? [], conceptos: conceptos ?? [], unidades: unidades ?? [], monedas: lista, metodos: metodos ?? [],
    // Los gastos del día a día suelen ir en pesos
    monedaDefecto: lista.includes("COP") ? "COP" : empresa?.moneda_defecto ?? lista[0] ?? "USD",
  };
}

export type FilaGasto = {
  id: number; fecha: string; concepto_id: number; cantidad: number | null; unidad: string | null; monto: number; moneda: string;
  metodo_id: number | null; lugar: string | null; pagado_por: string | null; nota: string | null; foto_path: string | null;
  concepto: string; categoria: string; categoria_id: number; metodo: string | null; foto_firmada: string | null;
};

/** Página de gastos con filtros. El resumen se consulta por separado. */
export async function cargarGastos(f: { desde: string; hasta: string; categoriaId?: number | null; conceptoId?: number | null }, pagina = 1) {
  const supabase = await crearClienteServidor();
  const consulta = () => {
      let q = supabase.from("gastos")
        .select("id, fecha, concepto_id, cantidad, unidad, monto, moneda, metodo_id, lugar, pagado_por, nota, foto_path, conceptos_gasto!inner(nombre, categoria_id, categorias_gasto(nombre)), metodos_pago(nombre)", { count: "exact" })
        .gte("fecha", f.desde).lte("fecha", f.hasta)
        .order("fecha", { ascending: false }).order("id", { ascending: false });
      if (f.conceptoId) q = q.eq("concepto_id", f.conceptoId);
      if (f.categoriaId) q = q.eq("conceptos_gasto.categoria_id", f.categoriaId);
      return q;
  };
  const resultado = await leerPagina((d, h) => consulta().range(d, h), pagina);
  const data = resultado.filas;
  const rutas = (data ?? []).map((g) => g.foto_path).filter((r): r is string => !!r);
  const firmadas = new Map<string, string>();
  if (rutas.length) {
    const { data: urls } = await supabase.storage.from("gastos").createSignedUrls(rutas, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
  }
  const filas = (data ?? []).map((g): FilaGasto => ({
    id: g.id, fecha: g.fecha, concepto_id: g.concepto_id, cantidad: g.cantidad === null ? null : Number(g.cantidad), unidad: g.unidad,
    monto: Number(g.monto), moneda: g.moneda, metodo_id: g.metodo_id, lugar: g.lugar, pagado_por: g.pagado_por, nota: g.nota, foto_path: g.foto_path,
    concepto: g.conceptos_gasto.nombre, categoria_id: g.conceptos_gasto.categoria_id, categoria: g.conceptos_gasto.categorias_gasto?.nombre ?? "",
    metodo: g.metodos_pago?.nombre ?? null, foto_firmada: g.foto_path ? firmadas.get(g.foto_path) ?? null : null,
  }));
  return { filas, pagina: resultado.pagina, total: resultado.total, porPagina: resultado.porPagina };
}

/** Resumen independiente de la página: recupera todas las filas del filtro sin fotos ni detalles. */
export async function cargarResumenGastos(f: { desde: string; hasta: string; categoriaId?: number | null; conceptoId?: number | null }) {
  const supabase = await crearClienteServidor();
  return leerTodos((d, h) => {
    let q = supabase.from("gastos").select("id, moneda, monto, conceptos_gasto!inner(categoria_id, categorias_gasto(nombre))", { count: "exact" })
      .gte("fecha", f.desde).lte("fecha", f.hasta).order("id");
    if (f.conceptoId) q = q.eq("concepto_id", f.conceptoId);
    if (f.categoriaId) q = q.eq("conceptos_gasto.categoria_id", f.categoriaId);
    return q.range(d, h);
  });
}
