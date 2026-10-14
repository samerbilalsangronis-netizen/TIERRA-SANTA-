import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearMonto, formatearNumero } from "@/lib/dinero";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Paginacion } from "@/components/comunes/paginacion";
import { FiltrosFacturas } from "@/features/facturacion/filtros";
import { ListaFacturas } from "@/features/facturacion/lista";

export const metadata: Metadata = { title: "Facturación" };
const POR_PAGINA = 50;
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const ESTADOS = ["por_cobrar", "pendiente", "abonada", "pagada", "anulada", "borrador"];

export default async function PaginaFacturacion({ searchParams }: PageProps<"/facturacion">) {
  await exigirPerfil("facturar");
  const sp = await searchParams;
  const filtros = {
    q: t(sp.q), estado: ESTADOS.includes(t(sp.estado)) ? t(sp.estado) : "", moneda: t(sp.moneda).slice(0, 3),
    desde: fecha(t(sp.desde)), hasta: fecha(t(sp.hasta)),
  };
  const pagina = Math.max(1, Number.parseInt(t(sp.pagina), 10) || 1);
  const args = {
    p_q: filtros.q || undefined, p_estado: filtros.estado || undefined, p_moneda: filtros.moneda || undefined,
    p_desde: filtros.desde || undefined, p_hasta: filtros.hasta || undefined,
  };
  const supabase = await crearClienteServidor();
  const [{ data: facturas, error }, { data: totales }, { data: monedas }, { data: empresa }] = await Promise.all([
    supabase.rpc("buscar_facturas", { ...args, p_limite: POR_PAGINA, p_desplazamiento: (pagina - 1) * POR_PAGINA }),
    supabase.rpc("totales_facturas", args),
    supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
    supabase.from("empresa").select("factura_prefijo, titulo_documento").eq("id", 1).single(),
  ]);
  const cantidad = (totales ?? []).reduce((a, x) => a + Number(x.cantidad), 0);
  const hayFiltros = Boolean(filtros.q || filtros.estado || filtros.moneda || filtros.desde || filtros.hasta);

  return (
    <>
      <EncabezadoPagina icono={FileText} titulo="Facturación" descripcion="Emisión, búsqueda, impresión y PDF de facturas."
        acciones={<Link href="/facturacion/nueva" className={buttonVariants({ size: "lg" })}><Plus className="size-4" /> Nueva {(empresa?.titulo_documento ?? "factura").toLowerCase()}</Link>} />
      <FiltrosFacturas inicial={filtros} monedas={(monedas ?? []).map((m) => m.codigo)} />

      {(totales ?? []).length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(totales ?? []).map((x) => (
            <div key={x.moneda} className="rounded-2xl border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {formatearNumero(x.cantidad, 0)} factura{Number(x.cantidad) === 1 ? "" : "s"} en {x.moneda}
                {Number(x.anuladas) > 0 && ` · ${x.anuladas} anulada${Number(x.anuladas) === 1 ? "" : "s"}`}
              </p>
              <p className="tabular text-xl font-bold">{formatearMonto(x.total, x.moneda)}</p>
              {Number(x.saldo) > 0 && <p className="tabular text-xs text-warning">Por cobrar {formatearMonto(x.saldo, x.moneda)}</p>}
            </div>
          ))}
        </div>
      )}

      {error ? <p className="text-sm text-destructive">No se pudo cargar la lista: {error.message}</p>
        : (facturas ?? []).length === 0 ? (
          <EstadoVacio icono={FileText} titulo={hayFiltros ? "Ninguna factura coincide" : "Todavía no hay facturas"}
            descripcion={hayFiltros ? "Prueba con otros filtros." : "Pulsa “Nueva factura” para emitir la primera."} />
        ) : (
          <div className="space-y-3">
            <ListaFacturas facturas={(facturas ?? []).map((f) => ({ ...f, saldo: Number(f.saldo ?? 0) }))} prefijo={empresa?.factura_prefijo ?? ""} />
            {cantidad > POR_PAGINA && <Paginacion pagina={pagina} total={cantidad} porPagina={POR_PAGINA} />}
          </div>
        )}
    </>
  );
}
