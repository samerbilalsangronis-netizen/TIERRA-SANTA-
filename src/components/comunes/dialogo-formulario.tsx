"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Marco común de los formularios de catálogo (diálogo con desplazamiento en teléfono). */
export function DialogoFormulario({
  abierto, onCerrar, titulo, descripcion, onEnviar, pendiente, children, textoGuardar = "Guardar", resumenPie,
}: {
  abierto: boolean; onCerrar: () => void; titulo: string; descripcion?: string;
  onEnviar: (e: React.FormEvent) => void; pendiente: boolean; children: React.ReactNode; textoGuardar?: string;
  /** Texto siempre visible junto a los botones (ej. el total). */
  resumenPie?: React.ReactNode;
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onEnviar} noValidate className="grid gap-3 sm:grid-cols-2">
          {children}
          <DialogFooter className="sticky -bottom-4 z-10 flex-row flex-wrap items-center justify-end bg-popover sm:col-span-2">
            {resumenPie && <div className="mr-auto min-w-0 basis-full pb-1 sm:basis-auto sm:pb-0">{resumenPie}</div>}
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={pendiente}>{pendiente && <Loader2 className="size-4 animate-spin" />} {textoGuardar}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
