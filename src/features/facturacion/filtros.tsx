"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FiltrosFactura = { q: string; estado: string; moneda: string; desde: string; hasta: string };

const ESTADOS: [string, string][] = [
  ["", "Todas"], ["por_cobrar", "Por cobrar"], ["pagada", "Pagadas"], ["anulada", "Anuladas"], ["borrador", "Borradores"],
];

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs transition-colors", activo ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}

export function FiltrosFacturas({ inicial, monedas }: { inicial: FiltrosFactura; monedas: string[] }) {
  const router = useRouter();
  const ruta = usePathname();
  const [f, setF] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  const primera = useRef(true);

  function aplicar(n: FiltrosFactura) {
    const qs = new URLSearchParams(Object.entries(n).filter(([, v]) => v));
    iniciar(() => router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  }
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const t = setTimeout(() => aplicar(f), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q]);
  const cambiar = (p: Partial<FiltrosFactura>) => { const n = { ...f, ...p }; setF(n); if (!("q" in p)) aplicar(n); };
  const hay = f.estado || f.moneda || f.desde || f.hasta;

  return (
    <div className="no-print mb-4 space-y-2 rounded-2xl border bg-card p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={f.q} onChange={(e) => cambiar({ q: e.target.value })} className="pl-8" aria-label="Buscar factura"
          placeholder="Buscar por nº de factura, cliente, cédula/RIF o producto…" />
        {pendiente && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ESTADOS.map(([v, t]) => <Chip key={v || "todas"} activo={f.estado === v} onClick={() => cambiar({ estado: v })}>{t}</Chip>)}
        <span className="mx-1 h-4 w-px bg-border" />
        {monedas.map((m) => <Chip key={m} activo={f.moneda === m} onClick={() => cambiar({ moneda: f.moneda === m ? "" : m })}>{m}</Chip>)}
        <div className="flex items-center gap-1.5">
          <Input type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} className="h-8 w-[9.5rem] text-xs" aria-label="Desde" />
          <Input type="date" value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} className="h-8 w-[9.5rem] text-xs" aria-label="Hasta" />
        </div>
        {hay && (
          <button type="button" onClick={() => cambiar({ estado: "", moneda: "", desde: "", hasta: "" })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="size-3" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
