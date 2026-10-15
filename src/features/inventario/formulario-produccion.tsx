"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/comunes/campos";
import { formatearCantidad, parsearMonto } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import { registrarProduccion } from "./acciones";

type Producto = { id: number; codigo: number; nombre: string; emoji: string | null; unidad: string; total: number };

/** Producción del día: todos los productos en una lista; se escribe solo lo que se produjo. */
export function FormularioProduccion({ productos, ubicaciones, hoy, responsable }: {
  productos: Producto[]; ubicaciones: { id: number; nombre: string }[]; hoy: string; responsable: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [fecha, setFecha] = useState(hoy);
  const [ubicacionId, setUbicacionId] = useState(String(ubicaciones[0]?.id ?? ""));
  const [quien, setQuien] = useState(responsable);
  const [nota, setNota] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const llenos = productos.filter((p) => (parsearMonto(cantidades[p.id] ?? "")?.toNumber() ?? 0) > 0);
  const invalidos = productos.filter((p) => (cantidades[p.id] ?? "").trim() && !(parsearMonto(cantidades[p.id])?.gt(0)));

  function guardar() {
    if (invalidos.length) { toast.error(`Revisa la cantidad de ${invalidos[0].nombre}.`); return; }
    if (!llenos.length) { toast.error("Escribe la cantidad de al menos un producto."); return; }
    iniciar(async () => {
      const r = await registrarProduccion({
        fecha, ubicacion_id: ubicacionId, responsable: quien, nota,
        items: llenos.map((p) => ({ producto_id: p.id, cantidad: cantidades[p.id] })),
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje);
      router.push("/inventario?vista=produccion");
      router.refresh();
    });
  }

  return (
    <div className="pb-28">
      <Link href="/inventario" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inventario
      </Link>
      <h1 className="mb-1 font-heading text-xl font-bold sm:text-2xl">Registrar producción</h1>
      <p className="mb-4 text-sm text-muted-foreground">Escribe solo lo que se produjo. Se suma al inventario de producto terminado.</p>

      <section className={cn("mb-4 grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4", ubicaciones.length > 1 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        {ubicaciones.length > 1 && <div className="space-y-1.5">
          <Label htmlFor="ubicacion">Se guarda en</Label>
          <SelectNativo id="ubicacion" value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)}>
            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </SelectNativo>
        </div>}
        <div className="space-y-1.5">
          <Label htmlFor="responsable">Responsable</Label>
          <Input id="responsable" value={quien} onChange={(e) => setQuien(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nota">Nota</Label>
          <Input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
        </div>
      </section>

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {productos.map((p, i) => {
          const v = cantidades[p.id] ?? "";
          const malo = invalidos.includes(p);
          return (
            <li key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5", llenos.includes(p) && "bg-success/5")}>
              <span className="w-8 shrink-0 text-center font-mono text-xs text-muted-foreground">{p.codigo}</span>
              <label htmlFor={`cant-${p.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.emoji ? `${p.emoji} ` : ""}{p.nombre}</span>
                <span className="text-xs text-muted-foreground">Hay {formatearCantidad(p.total)} {p.unidad}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <Input id={`cant-${p.id}`} ref={(el) => { refs.current[i] = el; }} inputMode="decimal" placeholder="0" value={v} aria-invalid={malo}
                  aria-label={`Cantidad producida de ${p.nombre}`} className="h-11 w-28 text-right text-lg tabular sm:h-10"
                  onChange={(e) => setCantidades((c) => ({ ...c, [p.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const sig = refs.current[i + 1]; if (sig) sig.focus(); else guardar(); } }} />
                <span className="w-10 text-xs text-muted-foreground">{p.unidad}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-popover/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <p className="mr-auto text-sm text-muted-foreground">
            {llenos.length ? <><b className="text-foreground">{llenos.length}</b> producto{llenos.length === 1 ? "" : "s"}</> : "Nada escrito todavía"}
          </p>
          <Button size="lg" disabled={pendiente} onClick={guardar}>
            {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Factory className="size-4" />} Guardar producción
          </Button>
        </div>
      </div>
    </div>
  );
}
