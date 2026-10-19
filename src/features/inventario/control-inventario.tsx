"use client";
import { ClipboardCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccion } from "@/components/comunes/confirmar-accion";
import { formatearFechaHora } from "@/lib/fechas";
import { cambiarControlInventario } from "./acciones";

/**
 * Aviso del control de inventario: mientras no se active, las facturas no
 * descuentan stock. Se activa después de registrar el conteo general.
 */
export function ControlInventario({ desde, puedeCambiar }: { desde: string | null; puedeCambiar: boolean }) {
  const cambiar = async (activar: boolean) => {
    const r = await cambiarControlInventario(activar);
    if (r.ok) toast.success(r.mensaje); else toast.error(r.error);
  };
  if (desde) {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <ClipboardCheck className="size-3.5" aria-hidden />
        Las facturas descuentan del inventario desde el {formatearFechaHora(desde)}.
        {puedeCambiar && (
          <ConfirmarAccion titulo="¿Dejar de descontar al facturar?" textoConfirmar="Dejar de descontar" destructivo
            descripcion="Las facturas nuevas no bajarán el stock hasta que lo vuelvas a activar. Lo ya descontado no cambia."
            alConfirmar={() => cambiar(false)}
            disparador={<button type="button" className="underline underline-offset-2 hover:text-foreground">Dejar de descontar</button>} />
        )}
      </p>
    );
  }
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center" role="status">
      <Info className="size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Las facturas todavía no descuentan del inventario</p>
        <p className="text-muted-foreground">
          Se puede facturar sin que el stock quede en negativo. Cuando hagas el inventario general, registra lo que hay
          con <b>Ajuste</b> (conteo) en cada producto y luego activa el descuento.
        </p>
      </div>
      {puedeCambiar && (
        <ConfirmarAccion titulo="¿Empezar a descontar al facturar?" textoConfirmar="Empezar a descontar"
          descripcion="Hazlo cuando ya hayas registrado el conteo general. Desde este momento cada factura emitida bajará el stock; las facturas de antes no lo tocan."
          alConfirmar={() => cambiar(true)}
          disparador={<Button className="shrink-0"><ClipboardCheck className="size-4" /> Empezar a descontar al facturar</Button>} />
      )}
    </div>
  );
}
