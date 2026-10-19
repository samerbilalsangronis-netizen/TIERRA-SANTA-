import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { parsearMonto } from "@/lib/dinero";

export type FilaEstadoCuenta = {
  fecha: string | null; tipo: string; ref_id: number | null; detalle: string;
  cestas: number | null; kg: number | null; merma: number | null; cargo: number | null; abono: number | null; saldo: number;
};

/** Datos de cada entrega para la tabla: rubro, cantidad y precio según cómo se compró. */
export type DetalleEntrega = {
  rubro: string; emoji: string | null; modo: string; unidades: number;
  /** Precio unitario y a qué se refiere ("cesta", "kg" o "und"). */
  precio: number; por: "cesta" | "kg" | "und";
};

const valida = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Precio por cesta original de una entrega importada (la nota dice "2,18 cestas de 15 kg × 45.000"). */
function precioCestaImportada(nota: string | null) {
  const m = nota?.match(/cestas de [\d.,]+ kg × ([\d.,]+)/);
  return m ? parsearMonto(m[1])?.toNumber() ?? null : null;
}

/** Datos del estado de cuenta (cálculo en Postgres: estado_cuenta_proveedor). */
export async function obtenerEstadoCuenta(proveedorId: number, moneda: string | null, desde?: string | null, hasta?: string | null) {
  const supabase = await crearClienteServidor();
  const [{ data: proveedor }, { data: empresa }] = await Promise.all([
    supabase.from("proveedores").select("id, nombre, documento, telefono, ubicacion, moneda_habitual").eq("id", proveedorId).maybeSingle(),
    supabase.from("empresa").select("razon_social, rif, direccion, telefonos, logo_path").eq("id", 1).single(),
  ]);
  if (!proveedor) return null;
  const mon = moneda || proveedor.moneda_habitual;
  const { data: filas, error } = await supabase.rpc("estado_cuenta_proveedor", {
    p_proveedor_id: proveedorId, p_moneda: mon, p_desde: valida(desde) ?? undefined, p_hasta: valida(hasta) ?? undefined,
  });
  if (error) throw new Error(error.message);
  const lista = (filas ?? []) as FilaEstadoCuenta[];
  const ids = lista.filter((f) => f.tipo === "entrega" && f.ref_id).map((f) => f.ref_id!);
  const { data: entregas } = ids.length
    ? await supabase.from("entregas_proveedor")
        .select("id, modo_pesaje, precio, precio_kg, cestas, unidades, kg_por_cesta, nota, productos(nombre, emoji)").in("id", ids)
    : { data: [] };
  const detalles = new Map<number, DetalleEntrega>();
  for (const e of entregas ?? []) {
    const cestas = Number(e.cestas), precio = Number(e.precio);
    // Por cesta: precio por cesta. Importadas (precio total): total ÷ cestas si las hay, si no por kilo.
    const d: Pick<DetalleEntrega, "precio" | "por"> =
      e.modo_pesaje === "FIJO" ? { precio, por: "cesta" }
      : e.modo_pesaje === "UNIDAD" ? { precio, por: "und" }
      : e.modo_pesaje === "VARIABLE" && cestas > 0 ? { precio: precioCestaImportada(e.nota) ?? precio / cestas, por: "cesta" }
      : { precio: Number(e.precio_kg), por: "kg" };
    detalles.set(e.id, { rubro: e.productos?.nombre ?? "", emoji: e.productos?.emoji ?? null, modo: e.modo_pesaje, unidades: Number(e.unidades), ...d });
  }
  const movimientos = lista.filter((f) => f.tipo !== "saldo_anterior");
  return {
    proveedor, empresa, moneda: mon, desde: valida(desde), hasta: valida(hasta), filas: lista, detalles,
    totales: {
      cargos: movimientos.reduce((a, f) => a + Number(f.cargo ?? 0), 0),
      abonos: movimientos.reduce((a, f) => a + Number(f.abono ?? 0), 0),
      kg: movimientos.reduce((a, f) => a + Number(f.kg ?? 0), 0),
      merma: movimientos.reduce((a, f) => a + Number(f.merma ?? 0), 0),
      cestas: movimientos.reduce((a, f) => a + Number(f.cestas ?? 0), 0),
      saldoFinal: lista.length ? Number(lista[lista.length - 1].saldo) : 0,
    },
  };
}
