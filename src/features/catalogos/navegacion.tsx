"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const SECCIONES_CATALOGO = [
  { href: "/configuracion/catalogos/productos", titulo: "Productos" },
  { href: "/configuracion/catalogos/unidades", titulo: "Unidades" },
  { href: "/configuracion/catalogos/ubicaciones", titulo: "Ubicaciones" },
  { href: "/configuracion/catalogos/monedas", titulo: "Monedas y tasas" },
  { href: "/configuracion/catalogos/metodos-pago", titulo: "Métodos de pago" },
  { href: "/configuracion/catalogos/tareas", titulo: "Tareas de nómina" },
  { href: "/configuracion/catalogos/gastos", titulo: "Gastos" },
] as const;

export function NavegacionCatalogos() {
  const ruta = usePathname();
  if (ruta === "/configuracion/catalogos") return null;
  return (
    <nav className="-mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" aria-label="Catálogos">
      {SECCIONES_CATALOGO.map((s) => (
        <Link key={s.href} href={s.href} aria-current={ruta === s.href ? "page" : undefined}
          className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
            ruta === s.href ? "border-primary/50 bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
          {s.titulo}
        </Link>
      ))}
    </nav>
  );
}
