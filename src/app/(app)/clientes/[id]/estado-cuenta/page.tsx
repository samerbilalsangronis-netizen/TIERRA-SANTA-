import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoHoja, Hoja } from "@/components/comunes/hoja";
import { BotonImprimir, FiltrosEstadoCuenta } from "@/features/proveedores/controles-estado-cuenta";
import { obtenerEstadoCuentaCliente } from "@/features/clientes/estado-cuenta";

export const metadata: Metadata = { title: "Estado de cuenta" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function PaginaEstadoCuentaCliente({ params, searchParams }: PageProps<"/clientes/[id]/estado-cuenta">) {
  await exigirPerfil("ver_dashboard");
  const id = Number((await params).id);
  const sp = await searchParams;
  const datos = await obtenerEstadoCuentaCliente(id, t(sp.moneda) || null, t(sp.desde), t(sp.hasta));
  if (!datos) notFound();
  const { cliente, empresa, moneda, desde, hasta, filas, totales } = datos;
  const supabase = await crearClienteServidor();
  const { data: monedas } = await supabase.from("monedas").select("codigo").eq("activa", true).order("orden");
  const qs = new URLSearchParams({ moneda, ...(desde && { desde }), ...(hasta && { hasta }) });

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/clientes/${id}`} className="mr-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {cliente.nombre}
        </Link>
        <FiltrosEstadoCuenta moneda={moneda} desde={desde ?? ""} hasta={hasta ?? ""} monedas={(monedas ?? []).map((m) => m.codigo)} />
        <a href={`/clientes/${id}/estado-cuenta/excel?${qs}`} className={buttonVariants({ variant: "outline" })}><FileSpreadsheet className="size-4" /> Excel</a>
        <BotonImprimir />
      </div>
      <Hoja>
        <EncabezadoHoja empresa={empresa} titulo="ESTADO DE CUENTA"
          lineas={[`Cliente · Moneda ${moneda}`, desde || hasta ? `Del ${desde ? formatearFecha(desde) : "inicio"} al ${hasta ? formatearFecha(hasta) : "hoy"}` : "Todos los movimientos"]} />
        <section className="grid gap-1 border-b border-neutral-300 py-3 sm:grid-cols-2">
          <p><span className="text-neutral-500">Cliente:</span> <b>{cliente.nombre}</b> <span className="text-neutral-500">(nº {cliente.numero})</span></p>
          {cliente.documento && <p><span className="text-neutral-500">Cédula/RIF:</span> {cliente.documento}</p>}
          {cliente.telefono && <p><span className="text-neutral-500">Teléfono:</span> {cliente.telefono}</p>}
          {cliente.direccion && <p><span className="text-neutral-500">Dirección:</span> {cliente.direccion}</p>}
        </section>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-800 text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="py-1.5 pr-2">Fecha</th><th className="py-1.5 pr-2">Documento</th><th className="py-1.5 pr-2">Detalle</th>
                <th className="py-1.5 pr-2 text-right">Cargos</th><th className="py-1.5 pr-2 text-right">Abonos</th><th className="py-1.5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-neutral-500">Sin movimientos en este periodo.</td></tr>}
              {filas.map((f, i) => (
                <tr key={`${f.tipo}-${f.ref_id ?? i}`} className={f.tipo === "saldo_anterior" ? "bg-neutral-100 font-medium" : i % 2 ? "bg-neutral-50" : ""}>
                  <td className="whitespace-nowrap py-1 pr-2">{formatearFecha(f.fecha)}</td>
                  <td className="whitespace-nowrap py-1 pr-2 font-mono">{f.documento ?? ""}</td>
                  <td className="py-1 pr-2">{f.detalle}</td>
                  <td className="tabular whitespace-nowrap py-1 pr-2 text-right">{Number(f.cargo) ? formatearMonto(f.cargo, moneda, { sinCodigo: true }) : ""}</td>
                  <td className="tabular whitespace-nowrap py-1 pr-2 text-right">{Number(f.abono) ? formatearMonto(f.abono, moneda, { sinCodigo: true }) : ""}</td>
                  <td className="tabular whitespace-nowrap py-1 text-right font-medium">{formatearMonto(f.saldo, moneda, { sinCodigo: true })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-800 font-semibold">
                <td colSpan={3} className="py-1.5">Totales del periodo</td>
                <td className="tabular whitespace-nowrap py-1.5 pr-2 text-right">{formatearMonto(totales.cargos, moneda, { sinCodigo: true })}</td>
                <td className="tabular whitespace-nowrap py-1.5 pr-2 text-right">{formatearMonto(totales.abonos, moneda, { sinCodigo: true })}</td><td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <div className="rounded-lg border-2 border-neutral-800 px-4 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-neutral-600">{totales.saldoFinal > 0 ? "Saldo pendiente" : totales.saldoFinal < 0 ? "Saldo a favor del cliente" : "Al día"}</p>
            <p className="tabular text-xl font-bold">{formatearMonto(Math.abs(totales.saldoFinal), moneda)}</p>
          </div>
        </div>
        <p className="mt-6 text-[10px] text-neutral-500">Generado el {formatearFechaHora(new Date())} · Tierra Santa</p>
      </Hoja>
    </>
  );
}
