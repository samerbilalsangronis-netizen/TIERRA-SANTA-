import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONOS = {
  primario: "text-primary bg-primary/12 ring-primary/20",
  exito: "text-success bg-success/12 ring-success/20",
  alerta: "text-warning bg-warning/12 ring-warning/20",
  peligro: "text-destructive bg-destructive/12 ring-destructive/20",
  neutro: "text-muted-foreground bg-muted ring-border",
} as const;

export function TarjetaKpi({
  titulo, valor, detalle, icono: Icono, tono = "primario",
}: { titulo: string; valor: React.ReactNode; detalle?: React.ReactNode; icono: LucideIcon; tono?: keyof typeof TONOS }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg ring-1", TONOS[tono])}>
          <Icono className="size-4" />
        </span>
      </div>
      <p className="tabular mt-2 text-xl font-bold sm:text-2xl">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}
