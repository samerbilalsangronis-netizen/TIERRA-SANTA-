import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, FileSpreadsheet } from "lucide-react";
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
  const { proveedor, empresa, moneda, desde, hasta, filas, detalles, totales } = datos;
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
            <p className="text-lg font-bold tracking-wide text-neutral-900">ESTADO DE CUENTA</p>
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

        <h2 className="mt-5 flex items-center gap-2 border-b-2 border-amber-500 pb-1.5 text-sm font-extrabold uppercase tracking-wide">
          <ClipboardList className="size-4 text-amber-600" aria-hidden /> Movimientos del período
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-800">
                <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Tipo</th><th className="py-2 pr-2">Rubro</th>
                <th className="py-2 pr-2 text-right">Kg</th><th className="py-2 pr-2 text-right">Cestas</th><th className="py-2 pr-2 text-right">Precio</th>
                <th className="py-2 pr-2 text-center">Merma</th><th className="py-2 pr-2 text-right">Monto</th><th className="py-2 text-right">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-neutral-500">Sin movimientos en este periodo.</td></tr>
              )}
              {filas.map((f, i) => {
                const clave = `${f.tipo}-${f.ref_id ?? i}`;
                const saldo = <td className="tabular whitespace-nowrap py-2 text-right font-bold text-amber-600">{formatearMonto(f.saldo, moneda)}</td>;
                if (f.tipo === "saldo_anterior") {
                  return (
                    <tr key={clave} className="border-b border-neutral-100 bg-neutral-50">
                      <td className="whitespace-nowrap py-2 pr-2">{formatearFecha(f.fecha)}</td>
                      <td colSpan={7} className="py-2 pr-2 font-semibold text-neutral-700">Saldo anterior</td>{saldo}
                    </tr>
                  );
                }
                if (f.tipo === "abono") {
                  const extra = f.detalle.replace(/^Abono( · )?/, "");
                  return (
                    <tr key={clave} className="border-b border-neutral-100">
                      <td className="whitespace-nowrap py-2 pr-2">{formatearFecha(f.fecha)}</td>
                      <td className="whitespace-nowrap py-2 pr-2 font-semibold text-green-700"><span aria-hidden>💵</span> Abono</td>
                      <td colSpan={5} className="py-2 pr-2 italic text-neutral-600">Pago recibido{extra ? ` · ${extra}` : ""}</td>
                      <td className="tabular whitespace-nowrap py-2 pr-2 text-right font-bold text-green-700">−{formatearMonto(f.abono, moneda)}</td>{saldo}
                    </tr>
                  );
                }
                const d = f.ref_id ? detalles.get(f.ref_id) : undefined;
                return (
                  <tr key={clave} className="border-b border-neutral-100">
                    <td className="whitespace-nowrap py-2 pr-2">{formatearFecha(f.fecha)}</td>
                    <td className="whitespace-nowrap py-2 pr-2 font-semibold text-red-600"><span aria-hidden>🚚</span> Entrega</td>
                    <td className="py-2 pr-2 uppercase">{d?.rubro ?? f.detalle}</td>
                    <td className="tabular whitespace-nowrap py-2 pr-2 text-right">
                      {d?.modo === "UNIDAD" ? `${formatearCantidad(d.unidades)} und` : f.kg ? `${formatearCantidad(f.kg, 1)} kg` : "—"}
                    </td>
                    <td className="tabular py-2 pr-2 text-right">{Number(f.cestas) ? formatearCantidad(f.cestas, 2) : "—"}</td>
                    <td className="tabular whitespace-nowrap py-2 pr-2 text-right">
                      {d ? <>{formatearMonto(d.precio, moneda)}<span className="text-[10px] text-neutral-500">/{d.por}</span></> : "—"}
                    </td>
                    <td className="tabular whitespace-nowrap py-2 pr-2 text-center text-amber-600">{Number(f.merma) ? `${formatearCantidad(f.merma)} kg` : "—"}</td>
                    <td className="tabular whitespace-nowrap py-2 pr-2 text-right font-bold text-red-600">+{formatearMonto(f.cargo, moneda)}</td>{saldo}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-800 font-semibold">
                <td colSpan={3} className="py-2">Totales del periodo</td>
                <td className="tabular whitespace-nowrap py-2 pr-2 text-right">{formatearCantidad(totales.kg, 1)} kg</td>
                <td className="tabular py-2 pr-2 text-right">{formatearCantidad(totales.cestas, 2)}</td>
                <td />
                <td className="tabular whitespace-nowrap py-2 pr-2 text-center">{totales.merma ? `${formatearCantidad(totales.merma)} kg` : "—"}</td>
                <td className="tabular whitespace-nowrap py-2 pr-2 text-right">
                  <span className="block text-red-600">+{formatearMonto(totales.cargos, moneda)}</span>
                  <span className="block text-green-700">−{formatearMonto(totales.abonos, moneda)}</span>
                </td>
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
