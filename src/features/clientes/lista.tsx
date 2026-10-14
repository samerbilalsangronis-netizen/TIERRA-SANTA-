"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Package, Users } from "lucide-react";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { formatearMonto } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";

type Fila = Tables<"v_resumen_clientes">;

export function BadgeEstadoCliente({ estado }: { estado: string | null }) {
  const critico = estado === "CRÍTICO";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide",
      critico ? "border-warning/40 bg-warning/10 text-warning" : "border-success/40 bg-success/10 text-success")}>
      {estado}
    </span>
  );
}

export function ListaClientes({ clientes, hayFiltros }: { clientes: Fila[]; hayFiltros: boolean }) {
  const grupos = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const c of clientes) {
      const l = /[A-Z]/.test(c.letra ?? "") ? c.letra! : "#";
      m.set(l, [...(m.get(l) ?? []), c]);
    }
    return [...m.entries()];
  }, [clientes]);

  if (clientes.length === 0) {
    return <EstadoVacio icono={Users} titulo={hayFiltros ? "Ningún cliente coincide" : "Aún no hay clientes"}
      descripcion={hayFiltros ? "Prueba con otra búsqueda o filtro." : "Crea el primero con «Nuevo cliente»."} />;
  }

  return (
    <div className="relative flex gap-2">
      <div className="min-w-0 flex-1 space-y-4">
        {grupos.map(([letra, filas]) => (
          <section key={letra} id={`letra-${letra}`} className="scroll-mt-16">
            <h2 className="sticky top-14 z-[1] mb-2 bg-background/90 py-1 text-sm font-bold text-primary backdrop-blur">{letra}</h2>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filas.map((c) => {
                const critico = c.estado === "CRÍTICO";
                return (
                  <Link key={c.id} href={`/clientes/${c.id}`}
                    className={cn("group flex items-start gap-3 rounded-2xl border border-l-4 bg-card p-3 transition-colors hover:border-primary/40",
                      critico ? "border-l-warning" : "border-l-success", !c.activo && "opacity-55")}>
                    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/12 font-mono text-xs font-bold text-primary">
                      <span className="text-[9px] font-normal text-muted-foreground">Nº</span>{c.numero}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold group-hover:text-primary">{c.nombre}</p>
                        <BadgeEstadoCliente estado={c.estado} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{[c.documento, c.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}{!c.activo && " · inactivo"}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm font-semibold">
                        {Number(c.saldo_usd) !== 0 && <span className={cn("tabular", Number(c.saldo_usd) > 0 ? "text-warning" : "text-success")}>{formatearMonto(c.saldo_usd, "USD")}</span>}
                        {Number(c.saldo_cop) !== 0 && <span className={cn("tabular", Number(c.saldo_cop) > 0 ? "text-warning" : "text-success")}>{formatearMonto(c.saldo_cop, "COP")}</span>}
                        {Number(c.saldo_ves) !== 0 && <span className={cn("tabular", Number(c.saldo_ves) > 0 ? "text-warning" : "text-success")}>{formatearMonto(c.saldo_ves, "VES")}</span>}
                        {Number(c.saldo_usd) === 0 && Number(c.saldo_cop) === 0 && Number(c.saldo_ves) === 0 && <span className="text-success">Sin deuda</span>}
                      </div>
                      <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Package className="size-3" /> {c.cajas_pendientes} cajas</span>
                        {Number(c.facturas_pendientes) > 0 && <span>{c.facturas_pendientes} factura{Number(c.facturas_pendientes) === 1 ? "" : "s"} pendiente{Number(c.facturas_pendientes) === 1 ? "" : "s"}</span>}
                      </p>
                    </div>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">{clientes.length} cliente{clientes.length === 1 ? "" : "s"}</p>
      </div>
      {grupos.length > 1 && (
        <nav aria-label="Índice alfabético" className="no-print sticky top-16 flex h-fit flex-col items-center gap-0.5 self-start rounded-full border bg-card px-1 py-2">
          {grupos.map(([l]) => (
            <a key={l} href={`#letra-${l}`} className="flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-muted-foreground hover:bg-primary/15 hover:text-primary">{l}</a>
          ))}
        </nav>
      )}
    </div>
  );
}
