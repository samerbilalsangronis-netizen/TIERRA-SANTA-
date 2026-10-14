import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EstadoVacio({
  titulo, descripcion, icono: Icono = Inbox, accion,
}: { titulo: string; descripcion?: string; icono?: LucideIcon; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-6" />
      </div>
      <p className="font-medium">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-md text-sm text-muted-foreground">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
