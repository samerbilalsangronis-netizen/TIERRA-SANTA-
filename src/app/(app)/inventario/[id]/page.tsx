import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, History } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad } from "@/lib/dinero";
import { formatearFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { cargarStock, TIPOS_MOVIMIENTO } from "@/features/inventario/datos";
import { AccionesInventario, FiltrosUrl } from "@/features/inventario/dialogos";
import { BadgeIndicador } from "@/features/inventario/badge";

export const metadata: Metadata = { title: "Kardex" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/** Kardex de un producto: todos sus movimientos con el saldo después de cada uno. */
export default async function PaginaKardex({ params, searchParams }: PageProps<"/inventario/[id]">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const f = { desde: fecha(t(sp.desde)), hasta: fecha(t(sp.hasta)), ubicacion: /^\d+$/.test(t(sp.ubicacion)) ? t(sp.ubicacion) : "" };
  const supabase = await crearClienteServidor();
  const [{ filas, ubicaciones }, { data: kardex }] = await Promise.all([
    cargarStock(),
    supabase.rpc("kardex", {
      p_producto_id: id, p_desde: f.desde || undefined, p_hasta: f.hasta || undefined,
      p_ubicacion_id: f.ubicacion ? Number(f.ubicacion) : undefined, p_forma: "PT",
    }),
  ]);
  const p = filas.find((x) => x.id === id);
  if (!p) notFound();
  const filasK = [...(kardex ?? [])].reverse(); // más recientes primero
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  return (
    <>
      <Link href="/inventario" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inventario
      </Link>
      <section className="mb-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-xl font-bold sm:text-2xl"><span className="mr-2 font-mono text-base text-muted-foreground">{p.codigo}</span>{p.emoji} {p.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {ubicaciones.filter((u) => p.porUbicacion[u.id]).map((u) => `${u.nombre}: ${formatearCantidad(p.porUbicacion[u.id])} ${p.unidad}`).join(" · ") || "Sin existencia"}
            </p>
          </div>
          <div className="text-right">
            <p className="tabular text-2xl font-bold">{formatearCantidad(p.total)} <span className="text-sm font-normal text-muted-foreground">{p.unidad}</span></p>
            <BadgeIndicador indicador={p.indicador} />
          </div>
        </div>
        <div className="no-print mt-3 flex flex-wrap gap-2">
          <AccionesInventario productos={filas.filter((x) => x.activo)} ubicaciones={ubicaciones} productoInicial={p.id}
            puedeOperar={puede(perfil.rol, "inventario_operar")} puedeAjustar={puede(perfil.rol, "inventario_ajustar")} />
        </div>
      </section>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <FiltrosUrl valores={f} campos={[
          ...(ubicaciones.length > 1 ? [{ nombre: "ubicacion", tipo: "select" as const, etiqueta: "Ubicación", opciones: [["", "Todas las ubicaciones"], ...ubicaciones.map((u): [string, string] => [String(u.id), u.nombre])] as [string, string][] }] : []),
          { nombre: "desde", tipo: "fecha", etiqueta: "Desde" }, { nombre: "hasta", tipo: "fecha", etiqueta: "Hasta" },
        ]} />
        <a href={`/inventario/${id}/excel${qs ? `?${qs}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download className="size-4" /> Excel</a>
      </div>

      {filasK.length === 0 ? <EstadoVacio icono={History} titulo="Sin movimientos" /> : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Fecha</th><th className="p-3">Movimiento</th><th className="p-3">Ubicación</th><th className="p-3">Detalle</th>
                  <th className="p-3 text-right">Entra</th><th className="p-3 text-right">Sale</th><th className="p-3 text-right">Saldo</th></tr>
              </thead>
              <tbody className="divide-y">
                {filasK.map((k) => {
                  const tipo = TIPOS_MOVIMIENTO[k.tipo] ?? { texto: k.tipo, clase: "" };
                  return (
                    <tr key={k.id ?? "anterior"}>
                      <td className="whitespace-nowrap p-3 text-muted-foreground">{formatearFechaHora(k.fecha)}</td>
                      <td className={cn("p-3 font-medium", tipo.clase)}>{tipo.texto}</td>
                      <td className="p-3">{k.ubicacion}</td>
                      <td className="p-3 text-xs text-muted-foreground">{[k.referencia, k.nota].filter(Boolean).join(" · ")}</td>
                      <td className="tabular p-3 text-right text-success">{k.entrada ? formatearCantidad(k.entrada) : ""}</td>
                      <td className="tabular p-3 text-right text-destructive">{k.salida ? formatearCantidad(k.salida) : ""}</td>
                      <td className="tabular p-3 text-right font-semibold">{formatearCantidad(k.saldo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card md:hidden">
            {filasK.map((k) => {
              const tipo = TIPOS_MOVIMIENTO[k.tipo] ?? { texto: k.tipo, clase: "" };
              return (
                <li key={k.id ?? "anterior"} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium", tipo.clase)}>{tipo.texto}</p>
                    <p className="text-xs text-muted-foreground">{[formatearFechaHora(k.fecha), k.ubicacion, k.referencia, k.nota].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("tabular font-semibold", k.entrada ? "text-success" : "text-destructive")}>{k.entrada ? `+${formatearCantidad(k.entrada)}` : `−${formatearCantidad(k.salida)}`}</p>
                    <p className="tabular text-xs text-muted-foreground">saldo {formatearCantidad(k.saldo)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
