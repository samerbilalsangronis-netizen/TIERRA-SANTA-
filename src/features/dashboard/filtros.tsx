"use client";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PERIODOS, type ClavePeriodo } from "@/lib/periodos";
import { cn } from "@/lib/utils";

/** Fila única de filtros: periodo (con rango libre), moneda de los gráficos y, si se pide, proveedor. */
export function FiltrosDashboard({ periodo, desde, hasta, moneda, monedas, conMoneda = true, proveedores, proveedor = "", clientes, cliente = "" }: {
  periodo: ClavePeriodo; desde: string; hasta: string; moneda: string; monedas: string[]; conMoneda?: boolean;
  proveedores?: { id: number; nombre: string }[]; proveedor?: string;
  clientes?: { id: number; numero: number | null; nombre: string }[]; cliente?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [pendiente, iniciar] = useTransition();
  const ir = (c: Record<string, string>) => {
    const v = { p: periodo, desde, hasta, moneda, proveedor, cliente, ...c };
    const qs = new URLSearchParams();
    if (v.p !== "mes") qs.set("p", v.p);
    if (v.p === "rango") { qs.set("desde", v.desde); qs.set("hasta", v.hasta); }
    if (conMoneda && v.moneda) qs.set("moneda", v.moneda);
    if (proveedores && v.proveedor) qs.set("proveedor", v.proveedor);
    if (clientes && v.cliente) qs.set("cliente", v.cliente);
    iniciar(() => router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  };
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-1.5">
      {PERIODOS.map(([v, t]) => (
        <button key={v} type="button" onClick={() => ir({ p: v })} aria-pressed={periodo === v}
          className={cn("rounded-full border px-3 py-1 text-xs transition-colors", periodo === v ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
          {t}
        </button>
      ))}
      {periodo === "rango" && (
        <span className="flex items-center gap-1.5">
          <Input type="date" aria-label="Desde" value={desde} onChange={(e) => e.target.value && ir({ desde: e.target.value })} className="h-8 w-[9.5rem] text-xs" />
          <Input type="date" aria-label="Hasta" value={hasta} onChange={(e) => e.target.value && ir({ hasta: e.target.value })} className="h-8 w-[9.5rem] text-xs" />
        </span>
      )}
      {clientes && (
        <select aria-label="Cliente" value={cliente} onChange={(e) => ir({ cliente: e.target.value })}
          className={cn("h-8 max-w-[18rem] rounded-lg border bg-background px-2 text-xs", !cliente && "border-primary font-semibold")}>
          <option value="">Elige el cliente…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.numero ? `${c.numero} · ` : ""}{c.nombre}</option>)}
        </select>
      )}
      {proveedores && (
        <select aria-label="Proveedor" value={proveedor} onChange={(e) => ir({ proveedor: e.target.value })}
          className="h-8 max-w-[16rem] rounded-lg border bg-background px-2 text-xs">
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      )}
      {conMoneda && monedas.length > 1 && (
        <div className="ml-auto flex rounded-lg border p-0.5 text-xs" role="radiogroup" aria-label="Moneda de los gráficos">
          {monedas.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={moneda === m} onClick={() => ir({ moneda: m })}
              className={cn("rounded-md px-3 py-1 font-semibold", moneda === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m}</button>
          ))}
        </div>
      )}
      {pendiente && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
