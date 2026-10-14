import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

export type FilaEstadoCliente = {
  fecha: string | null; tipo: string; ref_id: number | null; documento: string | null; detalle: string;
  cargo: number | null; abono: number | null; saldo: number;
};
const valida = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Estado de cuenta del cliente en una moneda (cálculo en Postgres). */
export async function obtenerEstadoCuentaCliente(clienteId: number, moneda: string | null, desde?: string | null, hasta?: string | null) {
  const supabase = await crearClienteServidor();
  const [{ data: cliente }, { data: empresa }, { data: saldos }] = await Promise.all([
    supabase.from("clientes").select("id, numero, nombre, documento, telefono, direccion").eq("id", clienteId).maybeSingle(),
    supabase.from("empresa").select("razon_social, rif, direccion, telefonos, logo_path, moneda_defecto").eq("id", 1).single(),
    supabase.from("v_saldos_clientes_moneda").select("moneda").eq("cliente_id", clienteId),
  ]);
  if (!cliente) return null;
  const mon = moneda || saldos?.[0]?.moneda || empresa?.moneda_defecto || "USD";
  const { data, error } = await supabase.rpc("estado_cuenta_cliente", {
    p_cliente_id: clienteId, p_moneda: mon, p_desde: valida(desde) ?? undefined, p_hasta: valida(hasta) ?? undefined,
  });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaEstadoCliente[];
  const movs = filas.filter((f) => f.tipo !== "saldo_anterior");
  return {
    cliente, empresa, moneda: mon, desde: valida(desde), hasta: valida(hasta), filas,
    totales: {
      cargos: movs.reduce((a, f) => a + Number(f.cargo ?? 0), 0),
      abonos: movs.reduce((a, f) => a + Number(f.abono ?? 0), 0),
      saldoFinal: filas.length ? Number(filas[filas.length - 1].saldo) : 0,
    },
  };
}
