import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { numeroFactura } from "@/lib/facturas";
import { EncabezadoHoja, Hoja } from "@/components/comunes/hoja";
import { BotonImprimir } from "@/features/proveedores/controles-estado-cuenta";

export const metadata: Metadata = { title: "Recibo de pago" };

export default async function PaginaRecibo({ params }: PageProps<"/clientes/[id]/recibos/[pagoId]">) {
  await exigirPerfil("ver_dashboard");
  const { id, pagoId } = await params;
  const supabase = await crearClienteServidor();
  const [{ data: pago }, { data: empresa }] = await Promise.all([
    supabase.from("pagos_clientes")
      .select("id, numero, fecha, moneda, monto, tipo, referencia, nota, created_at, metodos_pago(nombre), profiles:created_by(nombre, email), clientes(id, numero, nombre, documento, telefono, direccion), pago_aplicaciones(monto, facturas(id, origen, numero, numero_externo, fecha, total, saldo))")
      .eq("id", Number(pagoId)).eq("cliente_id", Number(id)).maybeSingle(),
    supabase.from("empresa").select("razon_social, rif, direccion, telefonos, logo_path, factura_prefijo, pie_factura").eq("id", 1).single(),
  ]);
  if (!pago || pago.tipo !== "pago") notFound();
  const c = pago.clientes!;
  const aplicado = pago.pago_aplicaciones.reduce((a, x) => a + Number(x.monto), 0);
  const aFavor = Number(pago.monto) - aplicado;
  const autor = pago.profiles as { nombre: string; email: string } | null;

  return (
    <>
      <div className="no-print mb-4 flex items-center gap-2">
        <Link href={`/clientes/${c.id}`} className="mr-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {c.nombre}
        </Link>
        <BotonImprimir />
      </div>
      <Hoja>
        <EncabezadoHoja empresa={empresa} titulo={`RECIBO DE PAGO Nº ${String(pago.numero).padStart(6, "0")}`}
          lineas={[`Fecha: ${formatearFecha(pago.fecha)}`, `Moneda: ${pago.moneda}`]} />
        <section className="grid gap-1 border-b border-neutral-300 py-3 sm:grid-cols-2">
          <p><span className="text-neutral-500">Recibimos de:</span> <b>{c.nombre}</b> <span className="text-neutral-500">(cliente nº {c.numero})</span></p>
          {c.documento && <p><span className="text-neutral-500">Cédula/RIF:</span> {c.documento}</p>}
          {c.telefono && <p><span className="text-neutral-500">Teléfono:</span> {c.telefono}</p>}
          {c.direccion && <p><span className="text-neutral-500">Dirección:</span> {c.direccion}</p>}
        </section>
        <section className="flex flex-col gap-3 border-b border-neutral-300 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p><span className="text-neutral-500">Método:</span> {pago.metodos_pago?.nombre ?? "—"}</p>
            {pago.referencia && <p><span className="text-neutral-500">Referencia:</span> {pago.referencia}</p>}
            {pago.nota && <p><span className="text-neutral-500">Nota:</span> {pago.nota}</p>}
          </div>
          <div className="rounded-lg border-2 border-neutral-800 px-4 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-neutral-600">Monto recibido</p>
            <p className="tabular text-2xl font-bold">{formatearMonto(pago.monto, pago.moneda)}</p>
          </div>
        </section>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-600">Aplicado a</p>
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-800 text-left text-[11px] uppercase tracking-wide text-neutral-600">
              <th className="py-1.5 pr-2">Factura</th><th className="py-1.5 pr-2">Fecha</th>
              <th className="py-1.5 pr-2 text-right">Total factura</th><th className="py-1.5 pr-2 text-right">Abonado</th><th className="py-1.5 text-right">Saldo actual</th>
            </tr>
          </thead>
          <tbody>
            {pago.pago_aplicaciones.length === 0 && <tr><td colSpan={5} className="py-3 text-neutral-500">No se aplicó a facturas.</td></tr>}
            {pago.pago_aplicaciones.map((a, i) => (
              <tr key={a.facturas?.id ?? i} className={i % 2 ? "bg-neutral-50" : ""}>
                <td className="py-1 pr-2 font-mono">{a.facturas ? numeroFactura(a.facturas, empresa?.factura_prefijo ?? "") : "—"}</td>
                <td className="py-1 pr-2">{formatearFecha(a.facturas?.fecha)}</td>
                <td className="tabular py-1 pr-2 text-right">{formatearMonto(a.facturas?.total ?? 0, pago.moneda, { sinCodigo: true })}</td>
                <td className="tabular py-1 pr-2 text-right font-semibold">{formatearMonto(a.monto, pago.moneda, { sinCodigo: true })}</td>
                <td className="tabular py-1 text-right">{Number(a.facturas?.saldo ?? 0) > 0 ? formatearMonto(a.facturas?.saldo ?? 0, pago.moneda, { sinCodigo: true }) : "Pagada"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-800 font-semibold">
              <td colSpan={3} className="py-1.5">Total aplicado</td>
              <td className="tabular py-1.5 pr-2 text-right">{formatearMonto(aplicado, pago.moneda, { sinCodigo: true })}</td><td />
            </tr>
            {aFavor > 0.004 && (
              <tr><td colSpan={3} className="py-1">Pendiente por descontar (próximas facturas)</td>
                <td className="tabular py-1 pr-2 text-right">{formatearMonto(aFavor, pago.moneda, { sinCodigo: true })}</td><td /></tr>
            )}
          </tfoot>
        </table>
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-neutral-600">
          <div className="border-t border-neutral-500 pt-1">Recibido por{autor?.nombre ? `: ${autor.nombre}` : ""}</div>
          <div className="border-t border-neutral-500 pt-1">Entregado por (cliente)</div>
        </div>
        {empresa?.pie_factura && <p className="mt-6 text-center text-xs text-neutral-600">{empresa.pie_factura}</p>}
        <p className="mt-4 text-[10px] text-neutral-500">Registrado el {formatearFechaHora(pago.created_at)}</p>
      </Hoja>
    </>
  );
}
