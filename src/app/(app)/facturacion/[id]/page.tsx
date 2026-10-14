import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad, formatearMonto, formatearNumero } from "@/lib/dinero";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { numeroFactura } from "@/lib/facturas";
import { cargarEmpresaDocumento, cargarFactura } from "@/features/facturacion/datos";
import { HojaFactura } from "@/features/facturacion/hoja-factura";
import { AccionesFactura } from "@/features/facturacion/acciones-factura";
import { BadgeEstadoFactura } from "@/features/facturacion/lista";

export const metadata: Metadata = { title: "Factura" };

const CAMPOS: Record<string, string> = {
  cliente_nombre: "Cliente", fecha: "Fecha", moneda: "Moneda", condicion: "Condición", ubicacion_id: "Ubicación",
  observaciones: "Observaciones", iva_pct: "IVA %", subtotal: "Subtotal", iva: "IVA", total: "Total", estado: "Estado",
};
type LineaVersion = { codigo: number; descripcion: string; cantidad: number; precio_unitario: number };
const textoLineas = (ls: LineaVersion[] | null) =>
  (ls ?? []).map((l) => `${l.descripcion} ${formatearCantidad(l.cantidad)} × ${formatearCantidad(l.precio_unitario)}`).join(" · ") || "—";
const NUMERICOS = ["subtotal", "iva", "total"];
const valor = (k: string, v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : k === "fecha" ? formatearFecha(String(v))
    : NUMERICOS.includes(k) ? formatearNumero(Number(v), 2)
    : k === "condicion" ? (v === "contado" ? "Contado" : "Crédito")
    : String(v);

/** Resumen legible de lo que cambió en una edición. */
function describirCambios(cambios: Record<string, { antes: unknown; despues: unknown }> | null): string[] {
  if (!cambios) return [];
  const textos: string[] = [];
  for (const [k, c] of Object.entries(cambios)) {
    if (k === "lineas") textos.push(`Productos: ${textoLineas(c.antes as LineaVersion[])} → ${textoLineas(c.despues as LineaVersion[])}`);
    else if (k !== "cliente_id" && CAMPOS[k]) textos.push(`${CAMPOS[k]}: ${valor(k, c.antes)} → ${valor(k, c.despues)}`);
  }
  return textos;
}

export default async function PaginaFactura({ params, searchParams }: PageProps<"/facturacion/[id]">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const supabase = await crearClienteServidor();
  const [factura, empresa, { data: versiones }, { data: aplicaciones }, { data: puedeEditar }] = await Promise.all([
    cargarFactura(id),
    cargarEmpresaDocumento(),
    supabase.from("factura_versiones").select("id, version, accion, cambios, motivo, created_at, profiles:created_by(nombre)").eq("factura_id", id).order("version", { ascending: false }),
    supabase.from("pago_aplicaciones").select("id, monto, pagos_clientes(id, numero, fecha, tipo, metodos_pago(nombre))").eq("factura_id", id),
    supabase.rpc("puede_editar_facturas"),
  ]);
  if (!factura || !empresa) notFound();
  const sinPermiso = (await searchParams).sinpermiso === "1";
  const numero = numeroFactura(factura, empresa.factura_prefijo);

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <Link href="/facturacion" className="mr-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Facturación
        </Link>
        <BadgeEstadoFactura estado={factura.estado_pago} />
        {factura.estado === "emitida" && Number(factura.saldo) > 0 && (
          <span className="tabular text-sm text-warning">Debe {formatearMonto(factura.saldo, factura.moneda)}</span>
        )}
      </div>
      {sinPermiso && <p className="no-print mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">Tu rol no puede editar facturas emitidas (se configura en Empresa).</p>}
      <AccionesFactura id={factura.id} estado={factura.estado} numero={numero} clienteId={factura.cliente_id}
        puedeFacturar={puede(perfil.rol, "facturar")} puedeEditar={puede(perfil.rol, "facturar") && Boolean(puedeEditar)} />

      <HojaFactura factura={factura} empresa={empresa} />

      <div className="no-print mx-auto mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-semibold">Pagos aplicados</h2>
          {(aplicaciones ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos.</p> : (
            <ul className="divide-y text-sm">
              {(aplicaciones ?? []).map((a) => (
                <li key={a.id} className="flex justify-between gap-2 py-1.5">
                  <span>
                    {formatearFecha(a.pagos_clientes?.fecha)} · {a.pagos_clientes?.tipo === "conversion" ? "Conversión" : `Recibo ${a.pagos_clientes?.numero}`}
                    {a.pagos_clientes?.metodos_pago ? ` · ${a.pagos_clientes.metodos_pago.nombre}` : ""}
                  </span>
                  <span className="tabular font-medium text-success">{formatearMonto(a.monto, factura.moneda, { sinCodigo: true })}</span>
                </li>
              ))}
            </ul>
          )}
          {factura.estado === "emitida" && (
            <Link href={`/clientes/${factura.cliente_id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              {Number(factura.saldo) > 0 ? "Registrar un pago en la ficha del cliente →" : "Ver la ficha del cliente →"}
            </Link>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><History className="size-4" /> Historial</h2>
          {(versiones ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{factura.estado === "borrador" ? "Borrador sin emitir." : "Sin registros."}</p> : (
            <ol className="space-y-2 text-sm">
              {(versiones ?? []).map((v) => {
                const autor = (v.profiles as { nombre: string } | null)?.nombre ?? "—";
                const cambios = describirCambios(v.cambios as Record<string, { antes: unknown; despues: unknown }> | null);
                return (
                  <li key={v.id} className="rounded-xl border p-2.5">
                    <p className="font-medium">
                      {v.accion === "EMITIR" ? "Emitida" : v.accion === "ANULAR" ? "Anulada" : `Editada (versión ${v.version})`}
                      <span className="font-normal text-muted-foreground"> · {autor} · {formatearFechaHora(v.created_at)}</span>
                    </p>
                    {v.motivo && <p className="text-xs text-muted-foreground">Motivo: {v.motivo}</p>}
                    {v.accion === "EDITAR" && cambios.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">{cambios.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
