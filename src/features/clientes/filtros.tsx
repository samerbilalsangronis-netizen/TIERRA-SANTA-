"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Filtros = { q: string; estado: string; moneda: string; inactivos: boolean };

function Chip({ activo, onClick, children, tono = "primario" }: { activo: boolean; onClick: () => void; children: React.ReactNode; tono?: "primario" | "alerta" | "exito" }) {
  const clase = { primario: "border-primary/50 bg-primary/15 text-primary", alerta: "border-warning/50 bg-warning/15 text-warning", exito: "border-success/50 bg-success/15 text-success" }[tono];
  return (
    <button type="button" onClick={onClick} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", activo ? clase : "text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}

export function FiltrosClientes({ inicial }: { inicial: Filtros }) {
  const router = useRouter();
  const ruta = usePathname();
  const [f, setF] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  const primera = useRef(true);

  function aplicar(n: Filtros) {
    const qs = new URLSearchParams();
    if (n.q) qs.set("q", n.q);
    if (n.estado) qs.set("estado", n.estado);
    if (n.moneda) qs.set("moneda", n.moneda);
    if (n.inactivos) qs.set("inactivos", "1");
    iniciar(() => router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  }
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const t = setTimeout(() => aplicar(f), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q]);
  const cambiar = (p: Partial<Filtros>) => { const n = { ...f, ...p }; setF(n); if (!("q" in p)) aplicar(n); };
  const hay = f.estado || f.moneda || f.inactivos;

  return (
    <div className="no-print mb-4 space-y-2 rounded-2xl border bg-card p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder="Buscar por nombre, número de cliente o cédula/RIF…" className="pl-8" aria-label="Buscar cliente" />
        {pendiente && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip activo={!f.estado} onClick={() => cambiar({ estado: "" })}>Todos</Chip>
        <Chip activo={f.estado === "CRÍTICO"} tono="alerta" onClick={() => cambiar({ estado: f.estado === "CRÍTICO" ? "" : "CRÍTICO" })}>Críticos</Chip>
        <Chip activo={f.estado === "AL DÍA"} tono="exito" onClick={() => cambiar({ estado: f.estado === "AL DÍA" ? "" : "AL DÍA" })}>Al día</Chip>
        <span className="mx-1 h-4 w-px bg-border" />
        <Chip activo={f.moneda === "USD"} onClick={() => cambiar({ moneda: f.moneda === "USD" ? "" : "USD" })}>Deben USD</Chip>
        <Chip activo={f.moneda === "COP"} onClick={() => cambiar({ moneda: f.moneda === "COP" ? "" : "COP" })}>Deben COP</Chip>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={f.inactivos} onCheckedChange={(v) => cambiar({ inactivos: Boolean(v) })} /> Inactivos
        </label>
        {hay && (
          <button type="button" onClick={() => cambiar({ estado: "", moneda: "", inactivos: false })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="size-3" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
