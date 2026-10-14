import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, FileText, LayoutDashboard, Package, Truck, Users } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { NAVEGACION } from "@/components/app/navegacion";
import { puede } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Dashboard" };

type KpisClientes = { clientes: number; saldo_usd: number; saldo_cop: number; cajas_pendientes: number; al_dia: number; criticos: number };
type KpisProveedores = { proveedores: number; saldo_cop: number; saldo_usd: number; cestas_pendientes: number };

export default async function PaginaDashboard() {
  const perfil = await exigirPerfil("ver_dashboard");
  const supabase = await crearClienteServidor();
  const [kc, kp, alertas] = await Promise.all([
    supabase.rpc("kpis_clientes"),
    supabase.rpc("kpis_proveedores"),
    supabase.from("v_stock_total").select("producto_id, codigo, nombre, emoji, unidad, stock_pt, stock_minimo, indicador")
      .eq("activo", true).neq("indicador", "normal").order("codigo").limit(8),
  ]);
  const c = (kc.data ?? {}) as Partial<KpisClientes>;
  const p = (kp.data ?? {}) as Partial<KpisProveedores>;

  return (
    <>
      <EncabezadoPagina
        icono={LayoutDashboard}
        titulo={`Hola, ${perfil.nombre.split(" ")[0] || perfil.email.split("@")[0]}`}
        descripcion="Resumen general. Las métricas de ventas, compras y producción por periodo llegan en la Fase 8."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaKpi titulo="Por cobrar USD" icono={Users} tono={(c.saldo_usd ?? 0) > 0 ? "alerta" : "exito"}
          valor={formatearMonto(c.saldo_usd ?? 0, "USD")} detalle={`${c.criticos ?? 0} clientes críticos`} />
        <TarjetaKpi titulo="Por cobrar COP" icono={Users} tono={(c.saldo_cop ?? 0) > 0 ? "alerta" : "exito"}
          valor={formatearMonto(c.saldo_cop ?? 0, "COP")} detalle={`${c.al_dia ?? 0} clientes al día`} />
        <TarjetaKpi titulo="Por pagar COP" icono={Truck} tono="primario"
          valor={formatearMonto(p.saldo_cop ?? 0, "COP")} detalle={`${p.proveedores ?? 0} proveedores`} />
        <TarjetaKpi titulo="Por pagar USD" icono={Truck} tono="primario"
          valor={formatearMonto(p.saldo_usd ?? 0, "USD")} detalle={`${p.cestas_pendientes ?? 0} cestas pendientes`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Accesos rápidos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NAVEGACION.filter((i) => i.href !== "/dashboard" && puede(perfil.rol, i.permiso)).map((i) => (
              <Link key={i.href} href={i.href}
                className="flex items-center gap-3 rounded-xl border bg-background/40 p-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent">
                <i.icono className="size-5 text-primary" /> {i.titulo}
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-warning" /> Alertas de inventario
          </h2>
          {(alertas.data ?? []).length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="size-4" /> Sin productos bajo el mínimo.
            </p>
          ) : (
            <ul className="space-y-2">
              {alertas.data!.map((a) => (
                <li key={a.producto_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{a.emoji} {a.codigo} · {a.nombre}</span>
                  <span className={a.indicador === "agotado" ? "font-semibold text-destructive" : "font-semibold text-warning"}>
                    {formatearCantidad(a.stock_pt)} {a.unidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/inventario" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Boxes className="size-3.5" /> Ver inventario
          </Link>
        </div>
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" /> Clientes registrados: {c.clientes ?? 0} · Cajas pendientes con clientes: {c.cajas_pendientes ?? 0}
      </p>
    </>
  );
}
