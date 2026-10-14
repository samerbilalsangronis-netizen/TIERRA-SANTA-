"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Marco común de los formularios de catálogo (diálogo con desplazamiento en teléfono). */
export function DialogoFormulario({
  abierto, onCerrar, titulo, descripcion, onEnviar, pendiente, children, textoGuardar = "Guardar",
}: {
  abierto: boolean; onCerrar: () => void; titulo: string; descripcion?: string;
  onEnviar: (e: React.FormEvent) => void; pendiente: boolean; children: React.ReactNode; textoGuardar?: string;
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
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente && <Loader2 className="size-4 animate-spin" />} {textoGuardar}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
