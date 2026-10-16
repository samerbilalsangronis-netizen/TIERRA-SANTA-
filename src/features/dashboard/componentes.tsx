import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { formatearMonto, formatearNumero } from "@/lib/dinero";
import { cn } from "@/lib/utils";

/** Cifra del periodo con su variación contra el periodo anterior. */
export function Cifra({ titulo, valor, detalle, delta, icono: Icono, subeEsBueno = true }: {
  titulo: string; valor: React.ReactNode; detalle?: React.ReactNode; delta?: number | null; icono: LucideIcon; subeEsBueno?: boolean;
}) {
  const bueno = delta == null || delta === 0 ? null : (delta > 0) === subeEsBueno;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
        <Icono className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="tabular mt-1.5 text-lg leading-tight font-bold sm:text-2xl">{valor}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {delta != null && (
          <span className={cn("inline-flex items-center font-medium", bueno === true && "text-success", bueno === false && "text-destructive")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {delta >= 0 ? "+" : "−"}{formatearNumero(Math.abs(delta), 0)} %
            <span className="sr-only"> contra el periodo anterior</span>
          </span>
        )}
        {detalle && <span>{detalle}</span>}
      </div>
    </div>
  );
}

/** Variación contra el periodo anterior (flecha y %). */
function Variacion({ delta, subeEsBueno }: { delta: number; subeEsBueno: boolean }) {
  const bueno = delta === 0 ? null : (delta > 0) === subeEsBueno;
  return (
    <span className={cn("inline-flex items-center text-xs font-medium", bueno === true && "text-success", bueno === false && "text-destructive", bueno === null && "text-muted-foreground")}>
      {delta >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      {delta >= 0 ? "+" : "−"}{formatearNumero(Math.abs(delta), 0)} %
      <span className="sr-only"> contra el periodo anterior</span>
    </span>
  );
}

/**
 * Montos en varias monedas dentro de una Cifra: una fila compacta por moneda
 * (código, monto y su variación), para que no se partan en varias líneas.
 */
export function MontosPorMoneda({ filas, subeEsBueno = true }: {
  filas: { moneda: string; total: number; delta?: number | null }[]; subeEsBueno?: boolean;
}) {
  return (
    <span className="mt-0.5 block space-y-1">
      {filas.map((f) => (
        <span key={f.moneda} className="flex items-baseline gap-2">
          <span className="w-8 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground">{f.moneda}</span>
          <span className="whitespace-nowrap text-lg leading-tight sm:text-xl">{formatearMonto(f.total, f.moneda, { sinCodigo: true })}</span>
          {f.delta != null && <span className="ml-auto font-normal"><Variacion delta={f.delta} subeEsBueno={subeEsBueno} /></span>}
        </span>
      ))}
    </span>
  );
}

/** Barras horizontales (ranking): nombre, barra y valor al final. */
export function Barras({ filas, vacio }: { filas: { clave: string | number; nombre: string; valor: number; texto: string; detalle?: string }[]; vacio: string }) {
  if (filas.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{vacio}</p>;
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ul className="space-y-2.5">
      {filas.map((f) => (
        <li key={f.clave} className="text-sm" title={f.detalle ? `${f.nombre}: ${f.texto} · ${f.detalle}` : `${f.nombre}: ${f.texto}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">{f.nombre}</span>
            <span className="tabular shrink-0 font-semibold">{f.texto}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--viz-pista)]">
            <div className="h-2.5 rounded-full bg-[var(--viz-1)]" style={{ width: `${Math.max((f.valor / max) * 100, 2)}%` }} />
          </div>
          {f.detalle && <p className="mt-0.5 text-[11px] text-muted-foreground">{f.detalle}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Tarjeta({ titulo, children, accion, className }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4", className)} aria-label={titulo}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}
