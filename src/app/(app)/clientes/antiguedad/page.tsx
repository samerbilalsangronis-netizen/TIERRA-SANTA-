import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Hourglass } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { FiltrosEstadoCuenta } from "@/features/proveedores/controles-estado-cuenta";

export const metadata: Metadata = { title: "Antigüedad de saldos" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function PaginaAntiguedad({ searchParams }: PageProps<"/clientes/antiguedad">) {
  await exigirPerfil("ver_dashboard");
  const sp = await searchParams;
  const moneda = t(sp.moneda) || "USD";
  const corte = /^\d{4}-\d{2}-\d{2}$/.test(t(sp.hasta)) ? t(sp.hasta) : hoyISO();
  const supabase = await crearClienteServidor();
  const [{ data: filas }, { data: monedas }] = await Promise.all([
    supabase.rpc("antiguedad_cxc", { p_corte: corte, p_moneda: moneda }),
    supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
  ]);
  const lista = filas ?? [];
  const suma = (k: "d0_15" | "d16_30" | "d31_60" | "d60_mas" | "total") => lista.reduce((a, f) => a + Number(f[k] ?? 0), 0);
  const cols = [["d0_15", "0–15 días"], ["d16_30", "16–30 días"], ["d31_60", "31–60 días"], ["d60_mas", "+60 días"]] as const;

  return (
    <>
      <Link href="/clientes" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Clientes</Link>
      <EncabezadoPagina icono={Hourglass} titulo="Antigüedad de saldos" descripcion={`Cuentas por cobrar en ${moneda} al ${formatearFecha(corte)}, por días desde la fecha de la factura.`}
        acciones={
          <>
            <FiltrosEstadoCuenta soloCorte moneda={moneda} desde="" hasta={corte} monedas={(monedas ?? []).map((m) => m.codigo)} />
            <a href={`/clientes/antiguedad/excel?moneda=${moneda}&hasta=${corte}`} className={buttonVariants({ variant: "outline" })}><FileSpreadsheet className="size-4" /> Excel</a>
          </>
        } />
      {lista.length === 0 ? <EstadoVacio icono={Hourglass} titulo={`Nadie debe en ${moneda}`} /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Cliente</th>{cols.map(([, t]) => <th key={t} className="p-3 text-right">{t}</th>)}<th className="p-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((f) => (
                <tr key={f.cliente_id}>
                  <td className="p-3"><Link href={`/clientes/${f.cliente_id}`} className="font-medium hover:text-primary">{f.nombre}</Link> <span className="text-xs text-muted-foreground">nº {f.numero}</span></td>
                  {cols.map(([k]) => (
                    <td key={k} className={`tabular p-3 text-right ${k === "d60_mas" && Number(f[k]) > 0 ? "font-semibold text-destructive" : ""}`}>
                      {Number(f[k] ?? 0) ? formatearMonto(f[k], moneda, { sinCodigo: true }) : "—"}
                    </td>
                  ))}
                  <td className="tabular p-3 text-right font-bold">{formatearMonto(f.total, moneda, { sinCodigo: true })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-semibold">
              <tr><td className="p-3">Total</td>{cols.map(([k]) => <td key={k} className="tabular p-3 text-right">{formatearMonto(suma(k), moneda, { sinCodigo: true })}</td>)}
                <td className="tabular p-3 text-right">{formatearMonto(suma("total"), moneda)}</td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
