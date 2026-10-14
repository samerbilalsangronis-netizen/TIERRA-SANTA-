import type { LucideIcon } from "lucide-react";

export function EncabezadoPagina({
  titulo, descripcion, icono: Icono, acciones,
}: { titulo: string; descripcion?: React.ReactNode; icono?: LucideIcon; acciones?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {Icono && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
            <Icono className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{titulo}</h1>
          {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
        </div>
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
