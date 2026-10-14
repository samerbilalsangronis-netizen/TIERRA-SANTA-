"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Filter, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SelectNativo } from "@/components/comunes/campos";
import { cn } from "@/lib/utils";

type Filtros = { q: string; moneda: string; saldo: boolean; rubro: string; desde: string; hasta: string; inactivos: boolean; tipo: string };

export function FiltrosProveedores({ inicial, rubros, monedas }: {
  inicial: Filtros; rubros: { id: number; codigo: number; nombre: string; categoria: string }[]; monedas: string[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [f, setF] = useState(inicial);
  const [abiertos, setAbiertos] = useState(Boolean(inicial.rubro || inicial.desde || inicial.hasta || inicial.inactivos));
  const [pendiente, iniciar] = useTransition();
  const primera = useRef(true);

  function aplicar(nuevo: Filtros) {
    const qs = new URLSearchParams();
    if (nuevo.q) qs.set("q", nuevo.q);
    if (nuevo.moneda) qs.set("moneda", nuevo.moneda);
    if (nuevo.saldo) qs.set("saldo", "1");
    if (nuevo.rubro) qs.set("rubro", nuevo.rubro);
    if (nuevo.desde) qs.set("desde", nuevo.desde);
    if (nuevo.hasta) qs.set("hasta", nuevo.hasta);
    if (nuevo.inactivos) qs.set("inactivos", "1");
    if (nuevo.tipo) qs.set("tipo", nuevo.tipo);
    iniciar(() => router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  }

  // Búsqueda mientras se escribe (con pausa)
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const t = setTimeout(() => aplicar(f), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q]);

  const cambiar = (parcial: Partial<Filtros>) => {
    const nuevo = { ...f, ...parcial };
    setF(nuevo);
    if (!("q" in parcial)) aplicar(nuevo);
  };
  const limpiar = () => cambiar({ q: "", moneda: "", saldo: false, rubro: "", desde: "", hasta: "", inactivos: false, tipo: "" });
  const activos = [f.moneda, f.saldo, f.rubro, f.desde, f.hasta, f.inactivos, f.tipo].filter(Boolean).length;

  return (
    <div className="no-print mb-4 space-y-2 rounded-2xl border bg-card p-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder="Buscar proveedor por nombre o cédula…" className="pl-8" aria-label="Buscar proveedor" />
          {pendiente && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="outline" onClick={() => setAbiertos((v) => !v)} aria-expanded={abiertos} className={cn(activos > 0 && "border-primary/50 text-primary")}>
          <Filter className="size-4" /> <span className="hidden sm:inline">Filtros</span>{activos > 0 && ` (${activos})`}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["", ...monedas].map((m) => (
          <button key={m || "todas"} type="button" onClick={() => cambiar({ moneda: m })}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors", f.moneda === m ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
            {m ? `Deben ${m}` : "Todos"}
          </button>
        ))}
        {([["fruta", "🍓 Fruta"], ["insumos", "🛍️ Insumos"]] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => cambiar({ tipo: f.tipo === v ? "" : v })}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors", f.tipo === v ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
        <button type="button" onClick={() => cambiar({ saldo: !f.saldo })}
          className={cn("rounded-full border px-3 py-1 text-xs transition-colors", f.saldo ? "border-warning/50 bg-warning/15 text-warning" : "text-muted-foreground hover:text-foreground")}>
          Con saldo pendiente
        </button>
        {activos > 0 && (
          <button type="button" onClick={limpiar} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="size-3" /> Limpiar
          </button>
        )}
      </div>
      {abiertos && (
        <div className="grid gap-2 border-t pt-2 sm:grid-cols-4">
          <SelectNativo value={f.rubro} onChange={(e) => cambiar({ rubro: e.target.value })} aria-label="Rubro">
            <option value="">Cualquier producto</option>
            {rubros.map((r) => <option key={r.id} value={r.id}>{r.codigo} · {r.nombre}</option>)}
          </SelectNativo>
          <Input type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} aria-label="Entregas desde" />
          <Input type="date" value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} aria-label="Entregas hasta" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={f.inactivos} onCheckedChange={(v) => cambiar({ inactivos: Boolean(v) })} /> Incluir inactivos
          </label>
        </div>
      )}
    </div>
  );
}
