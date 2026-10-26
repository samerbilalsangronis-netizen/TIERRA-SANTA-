"use client";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ListChecks, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Filtros del reporte de saldos de proveedores: la fruta que traen, solo los
 * que tienen saldo y, si se quiere, elegir proveedores uno por uno.
 */
export function FiltroSaldosProveedores({ rubros, rubro, proveedores, seleccion, soloConSaldo }: {
  rubros: { id: number; nombre: string }[]; rubro: string;
  /** Proveedores que cumplen la fruta elegida (para marcar). */
  proveedores: { id: number; nombre: string }[];
  seleccion: number[]; soloConSaldo: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");

  const ir = (c: { rubro?: string; sel?: number[]; saldo?: boolean }) => {
    const v = { rubro, sel: seleccion, saldo: soloConSaldo, ...c };
    const qs = new URLSearchParams();
    if (v.rubro) qs.set("rubro", v.rubro);
    if (v.sel.length) qs.set("sel", v.sel.join(","));
    if (v.saldo) qs.set("saldo", "1");
    iniciar(() => router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  };
  const abrir = () => {
    setMarcados(new Set(seleccion.length ? seleccion : proveedores.map((p) => p.id)));
    setQ("");
    setAbierto(true);
  };
  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return t ? proveedores.filter((p) => normalizar(p.nombre).includes(t)) : proveedores;
  }, [proveedores, q]);
  const cambiar = (id: number, si: boolean) => setMarcados((m) => { const n = new Set(m); if (si) n.add(id); else n.delete(id); return n; });
  const aplicar = () => {
    // Todos marcados = sin selección (así entran también los proveedores nuevos)
    const ids = proveedores.filter((p) => marcados.has(p.id)).map((p) => p.id);
    ir({ sel: ids.length === proveedores.length ? [] : ids });
    setAbierto(false);
  };

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <select aria-label="Fruta que traen" value={rubro} onChange={(e) => ir({ rubro: e.target.value, sel: [] })}
        className="h-8 rounded-lg border bg-background px-2 text-xs">
        <option value="">Todas las frutas</option>
        {rubros.map((r) => <option key={r.id} value={r.id}>Traen {r.nombre}</option>)}
      </select>
      <Button variant="outline" size="sm" onClick={abrir}>
        <ListChecks className="size-4" />
        {seleccion.length ? `${seleccion.length} proveedores elegidos` : "Elegir proveedores"}
      </Button>
      {seleccion.length > 0 && (
        <button type="button" onClick={() => ir({ sel: [] })} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Ver todos</button>
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={soloConSaldo} onCheckedChange={(v) => ir({ saldo: Boolean(v) })} /> Solo a los que se les debe
      </label>
      {pendiente && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[92dvh] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Elegir proveedores</DialogTitle>
            <DialogDescription>
              {rubro ? `Proveedores que traen ${rubros.find((r) => String(r.id) === rubro)?.nombre ?? "esa fruta"}.` : "Todos los proveedores."} Marca los que van en el reporte.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor…" className="pl-8" aria-label="Buscar proveedor" />
          </div>
          <div className="flex gap-3 text-xs">
            <button type="button" className="text-primary hover:underline" onClick={() => setMarcados(new Set(proveedores.map((p) => p.id)))}>Marcar todos</button>
            <button type="button" className="text-primary hover:underline" onClick={() => setMarcados(new Set())}>Ninguno</button>
            <span className="ml-auto text-muted-foreground">{marcados.size} de {proveedores.length}</span>
          </div>
          <ul className="max-h-[50dvh] space-y-0.5 overflow-y-auto">
            {visibles.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox checked={marcados.has(p.id)} onCheckedChange={(v) => cambiar(p.id, Boolean(v))} aria-label={p.nombre} />
                  {p.nombre}
                </label>
              </li>
            ))}
            {visibles.length === 0 && <li className="px-2 py-4 text-center text-sm text-muted-foreground">Sin proveedores.</li>}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={marcados.size === 0}>Ver reporte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
