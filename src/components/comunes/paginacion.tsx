"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatearNumero } from "@/lib/dinero";

/** Paginación del lado del servidor mediante ?pagina=N (conserva los demás filtros). */
export function Paginacion({ pagina, total, porPagina, parametro = "pagina" }: { pagina: number; total: number; porPagina: number; parametro?: string }) {
  const ruta = usePathname();
  const params = useSearchParams();
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const href = (p: number) => {
    const qs = new URLSearchParams(params.toString());
    if (p <= 1) qs.delete(parametro); else qs.set(parametro, String(p));
    return `${ruta}${qs.size ? `?${qs}` : ""}`;
  };
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        {formatearNumero(desde, 0)}–{formatearNumero(hasta, 0)} de {formatearNumero(total, 0)}
      </p>
      {paginas === 1 ? (
        <span className="text-muted-foreground">Página única</span>
      ) : (
        <div className="flex items-center gap-1">
          {pagina <= 1 ? (
            <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-50")}>
              <ChevronLeft className="size-4" /> Anterior
            </span>
          ) : (
            <Link prefetch={false} scroll={false} href={href(pagina - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ChevronLeft className="size-4" /> Anterior
            </Link>
          )}
          <span className="px-2 text-muted-foreground">{pagina} / {paginas}</span>
          {pagina >= paginas ? (
            <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-50")}>
              Siguiente <ChevronRight className="size-4" />
            </span>
          ) : (
            <Link prefetch={false} scroll={false} href={href(pagina + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Siguiente <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
