import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, Download, Factory, History, PackageX } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad } from "@/lib/dinero";
import { formatearFecha, formatearFechaHora, hoyISO, sumarDias } from "@/lib/fechas";
import { numeroFactura } from "@/lib/facturas";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Paginacion } from "@/components/comunes/paginacion";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { cargarStock, TIPOS_MOVIMIENTO, type FilaStock } from "@/features/inventario/datos";
import { AccionesInventario, BotonEliminarProduccion, FiltrosUrl } from "@/features/inventario/dialogos";
import { BadgeIndicador } from "@/features/inventario/badge";

export const metadata: Metadata = { title: "Inventario" };
const POR_PAGINA = 50;
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const VISTAS = [["stock", "Stock"], ["produccion", "Producción"], ["movimientos", "Movimientos"]] as const;

export default async function PaginaInventario({ searchParams }: PageProps<"/inventario">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const sp = await searchParams;
  const vista = VISTAS.some(([v]) => v === t(sp.vista)) ? t(sp.vista) : "stock";
  const { filas, ubicaciones } = await cargarStock();
  const operar = puede(perfil.rol, "inventario_operar");
  const ajustar = puede(perfil.rol, "inventario_ajustar");
  const bajos = filas.filter((f) => f.indicador === "bajo").length;
  const agotados = filas.filter((f) => f.indicador === "agotado").length;

  return (
    <>
      <EncabezadoPagina icono={Boxes} titulo="Inventario" descripcion="Producto terminado: sube con la producción y baja con facturas, merma y ajustes."
        acciones={<AccionesInventario productos={filas.filter((f) => f.activo)} ubicaciones={ubicaciones} puedeOperar={operar} puedeAjustar={ajustar} puedeCrearProducto={puede(perfil.rol, "configuracion")} />} />

      <section className="mb-4 grid grid-cols-3 gap-3">
        <TarjetaKpi titulo="Productos" icono={Boxes} valor={filas.filter((f) => f.total > 0).length} detalle="con existencia" />
        <TarjetaKpi titulo="Bajo el mínimo" icono={AlertTriangle} tono={bajos ? "alerta" : "exito"} valor={bajos} />
        <TarjetaKpi titulo="Agotados" icono={PackageX} tono={agotados ? "peligro" : "exito"} valor={agotados} />
      </section>

      <nav className="no-print mb-4 flex gap-1 rounded-xl border bg-card p-1 sm:w-fit" aria-label="Vistas del inventario">
        {VISTAS.map(([v, texto]) => (
          <Link key={v} href={v === "stock" ? "/inventario" : `/inventario?vista=${v}`} aria-current={vista === v ? "page" : undefined}
            className={cn("flex-1 rounded-lg px-4 py-1.5 text-center text-sm transition-colors sm:flex-none", vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {texto}
          </Link>
        ))}
      </nav>

      {vista === "stock" && <VistaStock filas={filas} ubicaciones={ubicaciones} />}
      {vista === "produccion" && <VistaProduccion sp={sp} esAdmin={ajustar} />}
      {vista === "movimientos" && <VistaMovimientos sp={sp} filas={filas} ubicaciones={ubicaciones} />}
    </>
  );
}

// ------------------------------------------------------------------ Stock
function VistaStock({ filas, ubicaciones }: { filas: FilaStock[]; ubicaciones: { id: number; nombre: string }[] }) {
  if (filas.length === 0) return <EstadoVacio icono={Boxes} titulo="Sin productos" descripcion="Crea los productos en Configuración → Catálogos." />;
  // Solo las ubicaciones que tienen algo (y la principal)
  const cols = ubicaciones.filter((u, i) => i === 0 || filas.some((f) => (f.porUbicacion[u.id] ?? 0) !== 0));
  return (
    <>
      <div className="mb-2 flex justify-end">
        <a href={`/inventario/excel`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download className="size-4" /> Excel</a>
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Producto</th>
              {cols.map((u) => <th key={u.id} className="p-3 text-right">{u.nombre}</th>)}
              <th className="p-3 text-right">Total</th><th className="p-3 text-right">Mínimo</th><th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((f) => (
              <tr key={f.id} className="hover:bg-muted/40">
                <td className="p-3">
                  <Link href={`/inventario/${f.id}`} className="font-medium hover:text-primary">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{f.codigo}</span>{f.emoji} {f.nombre}
                  </Link>
                </td>
                {cols.map((u) => <td key={u.id} className="tabular p-3 text-right text-muted-foreground">{f.porUbicacion[u.id] ? formatearCantidad(f.porUbicacion[u.id]) : "—"}</td>)}
                <td className="tabular p-3 text-right font-semibold">{formatearCantidad(f.total)} <span className="text-xs font-normal text-muted-foreground">{f.unidad}</span></td>
                <td className="tabular p-3 text-right text-muted-foreground">{f.stock_minimo ? formatearCantidad(f.stock_minimo) : "—"}</td>
                <td className="p-3"><BadgeIndicador indicador={f.indicador} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {filas.map((f) => (
          <li key={f.id}>
            <Link href={`/inventario/${f.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className="w-7 text-center font-mono text-xs text-muted-foreground">{f.codigo}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.emoji} {f.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {cols.filter((u) => f.porUbicacion[u.id]).map((u) => `${u.nombre}: ${formatearCantidad(f.porUbicacion[u.id])}`).join(" · ") || "Sin existencia"}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular font-semibold">{formatearCantidad(f.total)} <span className="text-xs font-normal text-muted-foreground">{f.unidad}</span></p>
                <BadgeIndicador indicador={f.indicador} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Toca un producto para ver su kardex (todos sus movimientos). Los productos nuevos y el stock mínimo se definen en Configuración → Catálogos → Productos (aparecen aquí si son de categoría Fruta).</p>
    </>
  );
}

// ------------------------------------------------------------------ Producción
async function VistaProduccion({ sp, esAdmin }: { sp: Record<string, string | string[] | undefined>; esAdmin: boolean }) {
  const hoy = hoyISO();
  const hasta = fecha(t(sp.hasta)) || hoy;
  const desde = fecha(t(sp.desde)) || sumarDias(hasta, -6);
  const supabase = await crearClienteServidor();
  const [{ data: resumen }, { data: registros }] = await Promise.all([
    supabase.rpc("produccion_resumen", { p_desde: desde, p_hasta: hasta }),
    supabase.from("producciones")
      .select("id, fecha, responsable, nota, created_at, ubicaciones(nombre), movimientos_inventario(cantidad, tipo, productos(codigo, nombre, emoji, unidad))")
      .gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(300),
  ]);
  const totales = new Map<number, { nombre: string; emoji: string | null; unidad: string; cantidad: number }>();
  for (const r of resumen ?? []) {
    const x = totales.get(r.producto_id) ?? { nombre: r.nombre, emoji: r.emoji, unidad: r.unidad, cantidad: 0 };
    x.cantidad += Number(r.cantidad);
    totales.set(r.producto_id, x);
  }
  return (
    <>
      <FiltrosUrl valores={{ vista: "produccion", desde, hasta }} campos={[{ nombre: "desde", tipo: "fecha", etiqueta: "Desde" }, { nombre: "hasta", tipo: "fecha", etiqueta: "Hasta" }]} />
      <section className="mb-4 rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Producido del {formatearFecha(desde)} al {formatearFecha(hasta)}</h2>
        {totales.size === 0 ? <p className="text-sm text-muted-foreground">Nada registrado en estas fechas.</p> : (
          <div className="flex flex-wrap gap-2">
            {[...totales.values()].map((x) => (
              <span key={x.nombre} className="rounded-xl border bg-success/5 px-3 py-1.5 text-sm">
                {x.emoji} {x.nombre} <b className="tabular">{formatearCantidad(x.cantidad)}</b> <span className="text-xs text-muted-foreground">{x.unidad}</span>
              </span>
            ))}
          </div>
        )}
      </section>
      {(registros ?? []).length === 0 ? (
        <EstadoVacio icono={Factory} titulo="Sin registros de producción" descripcion="Usa “Registrar producción” cada día." />
      ) : (
        <ul className="space-y-2">
          {(registros ?? []).map((r) => {
            const items = r.movimientos_inventario.filter((m) => m.tipo === "produccion");
            return (
              <li key={r.id} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-success/12 text-success">
                  <span className="text-[10px] leading-none">{formatearFecha(r.fecha).slice(3, 5)}/{formatearFecha(r.fecha).slice(8)}</span>
                  <span className="text-lg font-bold leading-none">{formatearFecha(r.fecha).slice(0, 2)}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{items.map((m) => `${m.productos?.emoji ?? ""} ${m.productos?.nombre} ${formatearCantidad(m.cantidad)} ${m.productos?.unidad}`).join(" · ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.ubicaciones?.nombre, r.responsable && `Responsable: ${r.responsable}`, r.nota].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {esAdmin && <BotonEliminarProduccion id={r.id} texto={`del ${formatearFecha(r.fecha)}`} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Movimientos
async function VistaMovimientos({ sp, filas, ubicaciones }: {
  sp: Record<string, string | string[] | undefined>; filas: FilaStock[]; ubicaciones: { id: number; nombre: string }[];
}) {
  const f = { vista: "movimientos", tipo: t(sp.tipo), producto: t(sp.producto), ubicacion: t(sp.ubicacion), desde: fecha(t(sp.desde)), hasta: fecha(t(sp.hasta)) };
  const pagina = Math.max(1, Number.parseInt(t(sp.pagina), 10) || 1);
  const supabase = await crearClienteServidor();
  const { data: empresa } = await supabase.from("empresa").select("factura_prefijo").eq("id", 1).single();
  let q = supabase.from("movimientos_inventario")
    .select("id, fecha, tipo, cantidad, nota, factura_id, producto_id, productos(codigo, nombre, emoji, unidad), ubicaciones(nombre), facturas(origen, numero, numero_externo), profiles:created_by(nombre)", { count: "exact" })
    .eq("forma", "PT").order("fecha", { ascending: false }).order("id", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (f.tipo === "traslado") q = q.in("tipo", ["traslado_salida", "traslado_entrada"]);
  else if (f.tipo === "venta") q = q.in("tipo", ["venta", "reverso_venta"]);
  else if (f.tipo) q = q.eq("tipo", f.tipo as "produccion");
  if (/^\d+$/.test(f.producto)) q = q.eq("producto_id", Number(f.producto));
  if (/^\d+$/.test(f.ubicacion)) q = q.eq("ubicacion_id", Number(f.ubicacion));
  if (f.desde) q = q.gte("fecha", `${f.desde}T00:00:00-04:00`);
  if (f.hasta) q = q.lt("fecha", `${sumarDias(f.hasta, 1)}T00:00:00-04:00`);
  const { data: movs, count } = await q;

  return (
    <>
      <FiltrosUrl valores={f} campos={[
        { nombre: "tipo", tipo: "select", etiqueta: "Tipo", opciones: [["", "Todos los tipos"], ["produccion", "Producción"], ["venta", "Facturas"], ["merma", "Merma"], ["traslado", "Traslados"], ["ajuste", "Ajustes"]] },
        { nombre: "producto", tipo: "select", etiqueta: "Producto", opciones: [["", "Todos los productos"], ...filas.map((p): [string, string] => [String(p.id), `${p.codigo} · ${p.nombre}`])] },
        ...(ubicaciones.length > 1 ? [{ nombre: "ubicacion", tipo: "select" as const, etiqueta: "Ubicación", opciones: [["", "Todas las ubicaciones"], ...ubicaciones.map((u): [string, string] => [String(u.id), u.nombre])] as [string, string][] }] : []),
        { nombre: "desde", tipo: "fecha", etiqueta: "Desde" }, { nombre: "hasta", tipo: "fecha", etiqueta: "Hasta" },
      ]} />
      {(movs ?? []).length === 0 ? <EstadoVacio icono={History} titulo="Sin movimientos" descripcion="Prueba con otros filtros." /> : (
        <div className="space-y-3">
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {(movs ?? []).map((m) => {
              const tipo = TIPOS_MOVIMIENTO[m.tipo] ?? { texto: m.tipo, clase: "" };
              const cant = Number(m.cantidad);
              const autor = (m.profiles as { nombre: string } | null)?.nombre;
              return (
                <li key={m.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className={tipo.clase}>{tipo.texto}</span> · <Link href={`/inventario/${m.producto_id}`} className="hover:text-primary">{m.productos?.emoji} {m.productos?.nombre}</Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[formatearFechaHora(m.fecha), m.ubicaciones?.nombre, autor].filter(Boolean).join(" · ")}
                      {m.factura_id && m.facturas && <> · <Link href={`/facturacion/${m.factura_id}`} className="text-primary hover:underline">Factura {numeroFactura(m.facturas, empresa?.factura_prefijo ?? "")}</Link></>}
                      {m.nota && !m.factura_id && <> · {m.nota}</>}
                    </p>
                  </div>
                  <p className={cn("tabular whitespace-nowrap font-semibold", cant > 0 ? "text-success" : "text-destructive")}>
                    {cant > 0 ? "+" : "−"}{formatearCantidad(Math.abs(cant))} <span className="text-xs font-normal text-muted-foreground">{m.productos?.unidad}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          {(count ?? 0) > POR_PAGINA && <Paginacion pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} />}
        </div>
      )}
    </>
  );
}
