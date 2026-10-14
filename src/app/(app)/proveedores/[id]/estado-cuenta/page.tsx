import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { LOGO_POR_DEFECTO_NEGRO, urlLogo } from "@/lib/empresa";
import { buttonVariants } from "@/components/ui/button";
import { obtenerEstadoCuenta } from "@/features/proveedores/estado-cuenta";
import { BotonImprimir, FiltrosEstadoCuenta } from "@/features/proveedores/controles-estado-cuenta";

export const metadata: Metadata = { title: "Estado de cuenta" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function PaginaEstadoCuenta({ params, searchParams }: PageProps<"/proveedores/[id]/estado-cuenta">) {
  await exigirPerfil("ver_dashboard");
  const id = Number((await params).id);
  const sp = await searchParams;
  const datos = await obtenerEstadoCuenta(id, t(sp.moneda) || null, t(sp.desde), t(sp.hasta));
  if (!datos) notFound();
  const { proveedor, empresa, moneda, desde, hasta, filas, totales } = datos;
  const supabase = await crearClienteServidor();
  const { data: monedas } = await supabase.from("monedas").select("codigo").eq("activa", true).order("orden");
  const logo = empresa?.logo_path ? urlLogo(empresa.logo_path) : LOGO_POR_DEFECTO_NEGRO;
  const qs = new URLSearchParams({ moneda, ...(desde && { desde }), ...(hasta && { hasta }) });

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/proveedores/${id}`} className="mr-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {proveedor.nombre}
        </Link>
        <FiltrosEstadoCuenta moneda={moneda} desde={desde ?? ""} hasta={hasta ?? ""} monedas={(monedas ?? []).map((m) => m.codigo)} />
        <a href={`/proveedores/${id}/estado-cuenta/excel?${qs}`} className={buttonVariants({ variant: "outline" })}>
          <FileSpreadsheet className="size-4" /> Excel
        </a>
        <BotonImprimir />
      </div>

      {/* Hoja (siempre clara, lista para imprimir o guardar como PDF) */}
      <article className="mx-auto max-w-4xl rounded-xl bg-white p-5 text-[13px] text-neutral-900 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-8">
        <header className="flex flex-col gap-4 border-b border-neutral-300 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-24 shrink-0">
              <Image src={logo} alt="" fill sizes="96px" className="object-contain" unoptimized={logo.startsWith("http")} />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold">{empresa?.razon_social}</p>
              <p className="text-xs text-neutral-600">{[empresa?.rif, empresa?.telefonos].filter(Boolean).join(" · ")}</p>
              {empresa?.direccion && <p className="text-xs text-neutral-600">{empresa.direccion}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-lg font-bold tracking-wide text-violet-700">ESTADO DE CUENTA</p>
            <p className="text-xs text-neutral-600">Proveedor · Moneda {moneda}</p>
            <p className="text-xs text-neutral-600">
              {desde || hasta ? `Del ${desde ? formatearFecha(desde) : "inicio"} al ${hasta ? formatearFecha(hasta) : "hoy"}` : "Todos los movimientos"}
            </p>
          </div>
        </header>

        <section className="grid gap-1 border-b border-neutral-300 py-3 sm:grid-cols-2">
          <p><span className="text-neutral-500">Proveedor:</span> <b>{proveedor.nombre}</b></p>
          {proveedor.documento && <p><span className="text-neutral-500">Cédula/RIF:</span> {proveedor.documento}</p>}
          {proveedor.telefono && <p><span className="text-neutral-500">Teléfono:</span> {proveedor.telefono}</p>}
          {proveedor.ubicacion && <p><span className="text-neutral-500">Ubicación:</span> {proveedor.ubicacion}</p>}
        </section>

        <div className="overflow-x-auto">
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-800 text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="py-1.5 pr-2">Fecha</th><th className="py-1.5 pr-2">Detalle</th>
                <th className="py-1.5 pr-2 text-right">Kg</th><th className="py-1.5 pr-2 text-right">Merma</th>
                <th className="py-1.5 pr-2 text-right">Entregas</th><th className="py-1.5 pr-2 text-right">Abonos</th><th className="py-1.5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-neutral-500">Sin movimientos en este periodo.</td></tr>
              )}
              {filas.map((f, i) => (
                <tr key={`${f.tipo}-${f.ref_id ?? i}`} className={f.tipo === "saldo_anterior" ? "bg-neutral-100 font-medium" : i % 2 ? "bg-neutral-50" : ""}>
                  <td className="whitespace-nowrap py-1 pr-2">{formatearFecha(f.fecha)}</td>
                  <td className="py-1 pr-2">{f.detalle}</td>
                  <td className="tabular py-1 pr-2 text-right">{f.kg ? formatearCantidad(f.kg) : ""}</td>
                  <td className="tabular py-1 pr-2 text-right">{f.merma ? formatearCantidad(f.merma) : ""}</td>
                  <td className="tabular whitespace-nowrap py-1 pr-2 text-right">{Number(f.cargo) ? formatearMonto(f.cargo, moneda, { sinCodigo: true }) : ""}</td>
                  <td className="tabular whitespace-nowrap py-1 pr-2 text-right">{Number(f.abono) ? formatearMonto(f.abono, moneda, { sinCodigo: true }) : ""}</td>
                  <td className="tabular whitespace-nowrap py-1 text-right font-medium">{formatearMonto(f.saldo, moneda, { sinCodigo: true })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-800 font-semibold">
                <td colSpan={2} className="py-1.5">Totales del periodo</td>
                <td className="tabular py-1.5 pr-2 text-right">{formatearCantidad(totales.kg)}</td>
                <td className="tabular py-1.5 pr-2 text-right">{formatearCantidad(totales.merma)}</td>
                <td className="tabular whitespace-nowrap py-1.5 pr-2 text-right">{formatearMonto(totales.cargos, moneda, { sinCodigo: true })}</td>
                <td className="tabular whitespace-nowrap py-1.5 pr-2 text-right">{formatearMonto(totales.abonos, moneda, { sinCodigo: true })}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="rounded-lg border-2 border-neutral-800 px-4 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-neutral-600">{totales.saldoFinal > 0 ? "Saldo a favor del proveedor" : totales.saldoFinal < 0 ? "Pagado de más" : "Saldo"}</p>
            <p className="tabular text-xl font-bold">{formatearMonto(Math.abs(totales.saldoFinal), moneda)}</p>
          </div>
        </div>
        <p className="mt-6 text-[10px] text-neutral-500">Generado el {formatearFechaHora(new Date())} · Tierra Santa</p>
      </article>
    </>
  );
}
