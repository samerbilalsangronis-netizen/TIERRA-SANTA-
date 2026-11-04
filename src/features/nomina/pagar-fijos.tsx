"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatearCantidad, formatearMonto, parsearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { pagarVarios } from "./acciones";
import type { EmpleadoLista } from "./datos";

/**
 * Pago semanal del personal fijo: todos los fijos a los que se les debe, marcados, con el monto
 * de lo que se les debe. Se puede desmarcar a alguno o bajar el monto (el resto queda acumulado).
 */
export function PagarFijos({ empleados, hoy, usuario }: { empleados: EmpleadoLista[]; hoy: string; usuario: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const deben = empleados.filter((e) => e.activo && e.tipo === "fijo" && e.saldo_neto > 0);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [fecha, setFecha] = useState(hoy);
  const [entregadoPor, setEntregadoPor] = useState(usuario);

  const abrir = () => {
    setMarcados(new Set(deben.map((e) => e.id)));
    setMontos(Object.fromEntries(deben.map((e) => [e.id, formatearCantidad(e.saldo_neto, 0)])));
    setFecha(hoy);
    setAbierto(true);
  };
  const monto = (id: number) => parsearMonto(montos[id] ?? "")?.toNumber() ?? 0;
  const total = deben.filter((e) => marcados.has(e.id)).reduce((a, e) => a + monto(e.id), 0);
  const cambiar = (id: number, si: boolean) => setMarcados((m) => { const n = new Set(m); if (si) n.add(id); else n.delete(id); return n; });
  const pagar = () => iniciar(async () => {
    const pagos = deben.filter((e) => marcados.has(e.id)).map((e) => ({ empleado_id: e.id, monto: montos[e.id] ?? "" }));
    const r = await pagarVarios({ fecha, entregado_por: entregadoPor, pagos });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.mensaje);
    setAbierto(false);
    router.refresh();
  });

  return (
    <>
      <Button size="lg" variant="outline" onClick={abrir}><Banknote className="size-4" /> Pagar a los fijos</Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pagar al personal fijo</DialogTitle>
            <DialogDescription>
              Marca a quién le pagas hoy. Si alguno se deja acumular, desmárcalo o baja el monto: lo que no se paga queda pendiente.
            </DialogDescription>
          </DialogHeader>
          {deben.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No se le debe nada a ningún empleado fijo.</p>
          ) : (
            <>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setMarcados(new Set(deben.map((e) => e.id)))}>Marcar todos</button>
                <button type="button" className="text-primary hover:underline" onClick={() => setMarcados(new Set())}>Ninguno</button>
              </div>
              <ul className="divide-y rounded-xl border">
                {deben.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox checked={marcados.has(e.id)} onCheckedChange={(v) => cambiar(e.id, Boolean(v))} aria-label={`Pagar a ${e.nombre}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Se le debe {formatearMonto(e.saldo_neto, "COP")}{e.ultimo_pago ? ` · último pago ${formatearFecha(e.ultimo_pago.fecha)}` : " · sin pagos"}
                      </p>
                    </div>
                    <Input value={montos[e.id] ?? ""} onChange={(ev) => setMontos((m) => ({ ...m, [e.id]: ev.target.value }))}
                      inputMode="decimal" aria-label={`Monto para ${e.nombre}`} disabled={!marcados.has(e.id)} className="h-9 w-28 text-right tabular" />
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">Fecha del pago<Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
                <label className="space-y-1 text-sm">Entregado por<Input value={entregadoPor} onChange={(e) => setEntregadoPor(e.target.value)} /></label>
              </div>
            </>
          )}
          <DialogFooter className="items-center">
            <p className="mr-auto text-sm">Total: <b className="tabular">{formatearMonto(total, "COP")}</b></p>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={pagar} disabled={pendiente || marcados.size === 0}>
              {pendiente && <Loader2 className="size-4 animate-spin" />} Registrar pagos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
