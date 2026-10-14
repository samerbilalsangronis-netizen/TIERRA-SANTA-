"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Package, Truck } from "lucide-react";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";

type Fila = Tables<"v_resumen_proveedores">;

export function SaldoMoneda({ valor, moneda, compacto }: { valor: number; moneda: string; compacto?: boolean }) {
  const debe = valor > 0;
  return (
    <span className={cn("tabular whitespace-nowrap font-semibold", debe ? "text-warning" : "text-success", compacto && "text-sm")}>
      {formatearMonto(valor, moneda)}
    </span>
  );
}

export function ListaProveedores({ proveedores, hayFiltros }: { proveedores: Fila[]; hayFiltros: boolean }) {
  const grupos = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const p of proveedores) {
      const l = /[A-Z]/.test(p.letra ?? "") ? p.letra! : "#";
      m.set(l, [...(m.get(l) ?? []), p]);
    }
    return [...m.entries()];
  }, [proveedores]);

  if (proveedores.length === 0) {
    return (
      <EstadoVacio icono={Truck} titulo={hayFiltros ? "Ningún proveedor coincide" : "Aún no hay proveedores"}
        descripcion={hayFiltros ? "Prueba con otros filtros." : "Crea el primero con «Nuevo proveedor»."} />
    );
  }

  return (
    <div className="relative flex gap-2">
      <div className="min-w-0 flex-1 space-y-4">
        {grupos.map(([letra, filas]) => (
          <section key={letra} id={`letra-${letra}`} className="scroll-mt-16">
            <h2 className="sticky top-14 z-[1] mb-2 bg-background/90 py-1 text-sm font-bold text-primary backdrop-blur">{letra}</h2>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filas.map((p) => {
                const debe = Boolean(p.con_saldo);
                return (
                  <Link key={p.id} href={`/proveedores/${p.id}`}
                    className={cn("group flex items-start gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/40",
                      debe ? "border-l-4 border-l-warning" : "border-l-4 border-l-success", !p.activo && "opacity-55")}>
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      debe ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
                      {(p.nombre ?? "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-primary">
                        {p.nombre}{!p.activo && " (inactivo)"}
                        {p.tipo !== "fruta" && <span className="ml-1.5 rounded-full border px-1.5 py-0.5 align-middle text-[10px] font-normal text-muted-foreground">{p.tipo === "insumos" ? "Insumos" : "Fruta e insumos"}</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.documento, p.ubicacion].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {(Number(p.saldo_cop) !== 0 || p.moneda_habitual === "COP") && <SaldoMoneda valor={Number(p.saldo_cop)} moneda="COP" compacto />}
                        {(Number(p.saldo_usd) !== 0 || p.moneda_habitual === "USD") && <SaldoMoneda valor={Number(p.saldo_usd)} moneda="USD" compacto />}
                        {Number(p.saldo_ves) !== 0 && <SaldoMoneda valor={Number(p.saldo_ves)} moneda="VES" compacto />}
                      </div>
                      <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {p.tipo !== "insumos" && <span className="inline-flex items-center gap-1"><Package className="size-3" /> {p.cestas_pendientes} cestas</span>}
                        {p.ultima_entrega && <span>Última entrega {formatearFecha(p.ultima_entrega)}</span>}
                      </p>
                    </div>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">{proveedores.length} proveedor{proveedores.length === 1 ? "" : "es"}</p>
      </div>
      {grupos.length > 1 && (
        <nav aria-label="Índice alfabético" className="no-print sticky top-16 flex h-fit flex-col items-center gap-0.5 self-start rounded-full border bg-card px-1 py-2">
          {grupos.map(([l]) => (
            <a key={l} href={`#letra-${l}`} className="flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-muted-foreground hover:bg-primary/15 hover:text-primary">
              {l}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
