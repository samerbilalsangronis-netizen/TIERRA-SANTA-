import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

export type FilaEstadoCuenta = {
  fecha: string | null; tipo: string; ref_id: number | null; detalle: string;
  cestas: number | null; kg: number | null; merma: number | null; cargo: number | null; abono: number | null; saldo: number;
};

const valida = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

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
  const movimientos = lista.filter((f) => f.tipo !== "saldo_anterior");
  return {
    proveedor, empresa, moneda: mon, desde: valida(desde), hasta: valida(hasta), filas: lista,
    totales: {
      cargos: movimientos.reduce((a, f) => a + Number(f.cargo ?? 0), 0),
      abonos: movimientos.reduce((a, f) => a + Number(f.abono ?? 0), 0),
      kg: movimientos.reduce((a, f) => a + Number(f.kg ?? 0), 0),
      merma: movimientos.reduce((a, f) => a + Number(f.merma ?? 0), 0),
      saldoFinal: lista.length ? Number(lista[lista.length - 1].saldo) : 0,
    },
  };
}
