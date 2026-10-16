import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, Factory, FileText, LayoutDashboard, Package, ShoppingBasket, Truck, Wallet } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { PERIODOS, rangoPeriodo, variacion, type ClavePeriodo } from "@/lib/periodos";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { FiltrosDashboard } from "@/features/dashboard/filtros";
import { Barras, Cifra, MontosPorMoneda, Tarjeta } from "@/features/dashboard/componentes";
import { GraficoVentas } from "@/features/dashboard/grafico-ventas";
import { GraficoRendimiento } from "@/features/dashboard/grafico-rendimiento";

export const metadata: Metadata = { title: "Dashboard" };

type Resumen = {
  ventas: { moneda: string; facturas: number; total: number }[];
  cobrado: { moneda: string; total: number }[];
  compras: { moneda: string; total: number; kg: number; merma: number }[];
  vendido: { unidades: number; kg: number };
  produccion_kg: number;
  nomina: { ganado: number; abonos: number } | null;
};
/** "bolsa" → "bolsas" (unidades simples) */
const plural = (u: string, n: number) => (n === 1 ? u : /[aeiou]$/.test(u) ? `${u}s` : u);
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const de = <K extends string>(xs: ({ moneda: string } & Record<K, number>)[], m: string, k: K) => Number(xs.find((x) => x.moneda === m)?.[k] ?? 0);

export default async function PaginaDashboard({ searchParams }: PageProps<"/dashboard">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const sp = await searchParams;
  const hoy = hoyISO();
  const clave = (PERIODOS.some(([v]) => v === t(sp.p)) ? t(sp.p) : "mes") as ClavePeriodo;
  const { actual, anterior } = rangoPeriodo(clave, hoy, { desde: fecha(t(sp.desde)), hasta: fecha(t(sp.hasta)) });
  const supabase = await crearClienteServidor();

  const [{ data: rA }, { data: rB }, { data: monedasDb }, { data: empresa }] = await Promise.all([
    supabase.rpc("resumen_periodo", { p_desde: actual.desde, p_hasta: actual.hasta }),
    supabase.rpc("resumen_periodo", { p_desde: anterior.desde, p_hasta: anterior.hasta }),
    supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
    supabase.from("empresa").select("moneda_defecto").eq("id", 1).single(),
  ]);
  const a = rA as unknown as Resumen;
  const b = rB as unknown as Resumen;
  const monedas = (monedasDb ?? []).map((m) => m.codigo);
  const masVendida = [...a.ventas].sort((x, y) => y.facturas - x.facturas)[0]?.moneda;
  const moneda = monedas.includes(t(sp.moneda)) ? t(sp.moneda) : masVendida ?? empresa?.moneda_defecto ?? "USD";

  const [{ data: porDia }, { data: productos }, { data: clientes }, { data: kc }, { data: kp }, { data: criticos }, { data: alertas }, { data: semanas }] = await Promise.all([
    supabase.rpc("ventas_por_dia", { p_desde: actual.desde, p_hasta: actual.hasta, p_moneda: moneda }),
    supabase.rpc("ventas_por_producto", { p_desde: actual.desde, p_hasta: actual.hasta, p_moneda: moneda }).limit(5),
    supabase.rpc("ventas_por_cliente", { p_desde: actual.desde, p_hasta: actual.hasta, p_moneda: moneda }).limit(10),
    supabase.rpc("kpis_clientes"),
    supabase.rpc("kpis_proveedores"),
    supabase.from("v_resumen_clientes").select("id, nombre, saldo_usd, saldo_cop, pendiente_desde").eq("estado", "CRÍTICO").order("pendiente_desde").limit(5),
    supabase.from("v_stock_total").select("producto_id, codigo, nombre, emoji, unidad, stock_pt, indicador")
      .eq("activo", true).eq("categoria", "fruta").neq("tipo", "materia_prima").neq("indicador", "normal").order("codigo").limit(6),
    supabase.rpc("ventas_semanales", { p_semanas: 12, p_moneda: moneda, p_hasta: hoy }),
  ]);
  const c = (kc ?? {}) as Record<string, number>;
  const p = (kp ?? {}) as Record<string, number>;
  const facturasA = a.ventas.reduce((s, v) => s + Number(v.facturas), 0);
  const facturasB = b.ventas.reduce((s, v) => s + Number(v.facturas), 0);
  const nombrePeriodo = PERIODOS.find(([v]) => v === clave)![1].toLowerCase();

  return (
    <>
      <EncabezadoPagina icono={LayoutDashboard} titulo={`Hola, ${perfil.nombre.split(" ")[0] || perfil.email.split("@")[0]}`}
        descripcion={`${formatearFecha(actual.desde)} – ${formatearFecha(actual.hasta)} · comparado con ${formatearFecha(anterior.desde)} – ${formatearFecha(anterior.hasta)}`} />
      <FiltrosDashboard periodo={clave} desde={actual.desde} hasta={actual.hasta} moneda={moneda} monedas={monedas} />

      {/* Cifras del periodo */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Cifras del periodo">
        {["USD", "COP"].filter((m) => monedas.includes(m)).map((m) => (
          <Cifra key={m} titulo={`Ventas ${m}`} icono={FileText} valor={formatearMonto(de(a.ventas, m, "total"), m)}
            delta={variacion(de(a.ventas, m, "total"), de(b.ventas, m, "total"))}
            detalle={`${de(a.ventas, m, "facturas")} facturas`} />
        ))}
        <Cifra titulo="Productos vendidos" icono={ShoppingBasket}
          valor={<>{formatearCantidad(a.vendido.unidades, 0)} <span className="text-sm font-normal text-muted-foreground">bolsas</span></>}
          delta={variacion(Number(a.vendido.unidades), Number(b.vendido.unidades))}
          detalle={`${formatearCantidad(a.vendido.kg, 1)} kg de pulpa`} />
        <Cifra titulo="Producción" icono={Factory} valor={<>{formatearCantidad(a.produccion_kg, 1)} <span className="text-sm font-normal text-muted-foreground">kg</span></>}
          delta={variacion(Number(a.produccion_kg), Number(b.produccion_kg))} detalle="de pulpa producida" />
        <Cifra titulo="Facturas" icono={FileText} valor={facturasA} delta={variacion(facturasA, facturasB)}
          detalle={a.ventas.length ? <>Promedio por factura: {a.ventas.map((v) => <span key={v.moneda} className="block">{formatearMonto(Number(v.total) / Math.max(Number(v.facturas), 1), v.moneda)}</span>)}</> : "—"} />
        <Cifra titulo="Cobrado" icono={Banknote}
          valor={a.cobrado.length > 1
            ? <MontosPorMoneda filas={a.cobrado.map((x) => ({ moneda: x.moneda, total: Number(x.total), delta: variacion(Number(x.total), de(b.cobrado, x.moneda, "total")) }))} />
            : formatearMonto(a.cobrado[0]?.total ?? 0, a.cobrado[0]?.moneda ?? moneda)}
          delta={a.cobrado.length === 1 ? variacion(Number(a.cobrado[0].total), de(b.cobrado, a.cobrado[0].moneda, "total")) : null}
          detalle="pagos recibidos de clientes" />
        <Cifra titulo="Compras a proveedores" icono={Truck} subeEsBueno={false}
          valor={a.compras.length > 1
            ? <MontosPorMoneda subeEsBueno={false} filas={a.compras.map((x) => ({ moneda: x.moneda, total: Number(x.total), delta: variacion(Number(x.total), de(b.compras, x.moneda, "total")) }))} />
            : formatearMonto(a.compras[0]?.total ?? 0, a.compras[0]?.moneda ?? "COP")}
          delta={a.compras.length === 1 ? variacion(Number(a.compras[0].total), de(b.compras, a.compras[0].moneda, "total")) : null}
          detalle={(() => { const kg = a.compras.reduce((s, x) => s + Number(x.kg), 0); const m = a.compras.reduce((s, x) => s + Number(x.merma ?? 0), 0);
            return kg ? `${formatearCantidad(kg, 0)} kg · merma ${formatearCantidad((m * 100) / kg, 1)} %` : "sin entregas"; })()} />
        {a.nomina && puede(perfil.rol, "nomina") && (
          <Cifra titulo="Nómina" icono={Wallet} subeEsBueno={false} valor={formatearMonto(a.nomina.ganado, "COP")}
            delta={variacion(Number(a.nomina.ganado), Number(b.nomina?.ganado ?? 0))} detalle={`abonos ${formatearMonto(a.nomina.abonos, "COP", { sinCodigo: true })}`} />
        )}
      </section>

      {/* Rendimiento semana contra semana */}
      <div className="mt-4">
        <GraficoRendimiento moneda={moneda} semanas={(semanas ?? []).map((x) => ({ semana: x.semana, unidades: Number(x.unidades), kg: Number(x.kg), total: Number(x.total) }))} />
      </div>

      {/* Gráficos */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo={`Ventas por día (${moneda})`} className="lg:col-span-2"
          accion={<Link href={`/reportes/ventas-producto?desde=${actual.desde}&hasta=${actual.hasta}&moneda=${moneda}`} className="text-xs text-primary hover:underline">Ver reporte</Link>}>
          <GraficoVentas moneda={moneda} puntos={(porDia ?? []).map((d) => ({ fecha: d.fecha, total: Number(d.total), facturas: Number(d.facturas) }))} />
        </Tarjeta>
        <Tarjeta titulo="Productos más vendidos">
          <Barras vacio={`Sin ventas en ${moneda} ${nombrePeriodo}.`}
            filas={(productos ?? []).map((x) => ({ clave: x.producto_id, nombre: x.nombre, valor: Number(x.monto), texto: formatearMonto(x.monto, moneda, { sinCodigo: true }),
              detalle: `${formatearCantidad(x.cantidad)} ${plural(x.unidad, Number(x.cantidad))}` }))} />
        </Tarjeta>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo={`Mejores clientes (${moneda})`}
          accion={<Link href={`/reportes/ventas-cliente?desde=${actual.desde}&hasta=${actual.hasta}&moneda=${moneda}`} className="text-xs text-primary hover:underline">Ver todos</Link>}>
          <Barras vacio={`Sin ventas en ${moneda} ${nombrePeriodo}.`}
            filas={(clientes ?? []).map((x) => ({ clave: x.cliente_id, nombre: x.nombre, valor: Number(x.total), texto: formatearMonto(x.total, moneda, { sinCodigo: true }),
              detalle: Number(x.saldo) > 0 ? `debe ${formatearMonto(x.saldo, moneda, { sinCodigo: true })}` : undefined }))} />
        </Tarjeta>

        <Tarjeta titulo="Por cobrar" accion={<Link href="/clientes?estado=CR%C3%8DTICO" className="text-xs text-primary hover:underline">Clientes</Link>}>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">USD</p><p className="tabular font-bold text-warning">{formatearMonto(c.saldo_usd ?? 0, "USD", { sinCodigo: true })}</p></div>
            <div><p className="text-xs text-muted-foreground">COP</p><p className="tabular font-bold text-warning">{formatearMonto(c.saldo_cop ?? 0, "COP", { sinCodigo: true })}</p></div>
          </div>
          <p className="mb-1 text-xs text-muted-foreground">Deben desde hace más tiempo</p>
          {(criticos ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Todos al día.</p> : (
            <ul className="divide-y text-sm">
              {(criticos ?? []).map((x) => (
                <li key={x.id}>
                  <Link href={`/clientes/${x.id}`} className="flex items-center justify-between gap-2 py-1.5 hover:text-primary">
                    <span className="min-w-0 truncate">{x.nombre}</span>
                    <span className="tabular shrink-0 text-xs">
                      {[Number(x.saldo_usd) > 0 && formatearMonto(x.saldo_usd, "USD"), Number(x.saldo_cop) > 0 && formatearMonto(x.saldo_cop, "COP")].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Alertas">
          <ul className="space-y-2 text-sm">
            {(alertas ?? []).map((x) => (
              <li key={x.producto_id}>
                <Link href={`/inventario/${x.producto_id}`} className="flex items-center justify-between gap-2 hover:text-primary">
                  <span className="flex min-w-0 items-center gap-1.5"><AlertTriangle className={x.indicador === "agotado" ? "size-3.5 shrink-0 text-destructive" : "size-3.5 shrink-0 text-warning"} aria-hidden />
                    <span className="truncate">{x.nombre}</span></span>
                  <span className="tabular shrink-0 text-xs">{x.indicador === "agotado" ? "Agotado" : `${formatearCantidad(x.stock_pt)} ${plural(x.unidad ?? "", Number(x.stock_pt))}`}</span>
                </Link>
              </li>
            ))}
            {(alertas ?? []).length === 0 && <li className="flex items-center gap-2 text-muted-foreground"><Boxes className="size-4" /> Stock en orden.</li>}
            <li className="flex items-center justify-between gap-2 border-t pt-2"><span className="flex items-center gap-1.5"><Package className="size-3.5" aria-hidden /> Cajas en clientes</span><b className="tabular">{c.cajas_pendientes ?? 0}</b></li>
            <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><Truck className="size-3.5" aria-hidden /> Cestas con proveedores</span><b className="tabular">{p.cestas_pendientes ?? 0}</b></li>
            <li className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Por pagar a proveedores</span>
              <b className="tabular text-xs">{[Number(p.saldo_cop) > 0 && formatearMonto(p.saldo_cop, "COP"), Number(p.saldo_usd) > 0 && formatearMonto(p.saldo_usd, "USD")].filter(Boolean).join(" · ") || "—"}</b></li>
          </ul>
        </Tarjeta>
      </section>
    </>
  );
}
