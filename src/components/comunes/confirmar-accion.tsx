"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Diálogo de confirmación antes de acciones destructivas o importantes. */
export function ConfirmarAccion({
  titulo, descripcion, textoConfirmar = "Confirmar", destructivo, alConfirmar, disparador, children,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  textoConfirmar?: string;
  destructivo?: boolean;
  alConfirmar: () => Promise<void> | void;
  disparador: React.ReactElement;
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  return (
    <AlertDialog open={abierto} onOpenChange={setAbierto}>
      <AlertDialogTrigger render={disparador} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descripcion && <AlertDialogDescription>{descripcion}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button
            variant={destructivo ? "destructive" : "default"}
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                await alConfirmar();
                setAbierto(false);
              })
            }
          >
            {pendiente && <Loader2 className="size-4 animate-spin" />}
            {textoConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
