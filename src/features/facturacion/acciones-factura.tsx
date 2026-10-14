"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Copy, Download, MoreHorizontal, Pencil, Printer, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { anularFacturaSistema } from "./acciones";

/** Barra de acciones de una factura: imprimir, PDF, editar, duplicar, anular. */
export function AccionesFactura({ id, estado, numero, clienteId, puedeFacturar, puedeEditar }: {
  id: number; estado: "borrador" | "emitida" | "anulada"; numero: string; clienteId: number; puedeFacturar: boolean; puedeEditar: boolean;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const borrador = estado === "borrador";

  function anular() {
    iniciar(async () => {
      const r = await anularFacturaSistema(id, motivo);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje);
      setDialogo(false);
      if (r.datos.borrador) router.push("/facturacion?estado=borrador"); else router.refresh();
    });
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      {borrador ? (
        puedeFacturar && <Link href={`/facturacion/${id}/editar`} className={buttonVariants({ size: "lg" })}><Send className="size-4" /> Continuar y emitir</Link>
      ) : (
        <>
          <Button size="lg" onClick={() => window.print()}><Printer className="size-4" /> Imprimir</Button>
          <a href={`/facturacion/${id}/pdf?descargar=1`} className={buttonVariants({ size: "lg", variant: "outline" })}><Download className="size-4" /> PDF</a>
        </>
      )}
      {puedeEditar && estado === "emitida" && (
        <Link href={`/facturacion/${id}/editar`} className={buttonVariants({ size: "lg", variant: "outline" })}><Pencil className="size-4" /> Editar</Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="lg" aria-label="Más acciones"><MoreHorizontal className="size-4" /> <span className="hidden sm:inline">Más</span></Button>} />
        <DropdownMenuContent align="end" className="w-56">
          {!borrador && <DropdownMenuItem render={<a href={`/facturacion/${id}/pdf`} target="_blank" rel="noreferrer" />}><Printer className="size-4" /> Ver PDF en otra pestaña</DropdownMenuItem>}
          {puedeFacturar && <DropdownMenuItem render={<Link href={`/facturacion/nueva?duplicar=${id}`} />}><Copy className="size-4" /> Duplicar (nueva factura)</DropdownMenuItem>}
          <DropdownMenuItem render={<Link href={`/clientes/${clienteId}`} />}><Users className="size-4" /> Ficha del cliente y pagos</DropdownMenuItem>
          {puedeFacturar && estado !== "anulada" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => { setMotivo(""); setDialogo(true); }}>
                {borrador ? <><Trash2 className="size-4" /> Descartar borrador</> : <><Ban className="size-4" /> Anular</>}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={dialogo} onOpenChange={setDialogo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{borrador ? "¿Descartar este borrador?" : `¿Anular la factura ${numero}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {borrador
                ? "El borrador se elimina. No afectaba inventario ni saldos."
                : "La factura queda visible como ANULADA (no se borra), el inventario se devuelve y deja de sumar a la deuda. Si tenía pagos, se descuentan de otras facturas pendientes del cliente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!borrador && <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la anulación (obligatorio)" aria-label="Motivo de la anulación" />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pendiente || (!borrador && motivo.trim().length < 3)} onClick={anular}>
              {borrador ? "Descartar" : "Anular factura"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
