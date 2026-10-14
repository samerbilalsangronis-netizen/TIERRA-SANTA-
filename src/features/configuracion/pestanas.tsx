"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/configuracion", titulo: "General", admin: false },
  { href: "/configuracion/empresa", titulo: "Empresa", admin: true },
  { href: "/configuracion/usuarios", titulo: "Usuarios", admin: true },
  { href: "/configuracion/catalogos", titulo: "Catálogos", admin: true },
  { href: "/configuracion/auditoria", titulo: "Auditoría", admin: true },
];

export function PestanasConfiguracion({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  return (
    <nav className="-mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0" aria-label="Secciones de configuración">
      {PESTANAS.filter((p) => esAdmin || !p.admin).map((p) => {
        const activa = p.href === "/configuracion" ? ruta === p.href : ruta.startsWith(p.href);
        return (
          <Link key={p.href} href={p.href} aria-current={activa ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              activa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}>
            {p.titulo}
          </Link>
        );
      })}
    </nav>
  );
}
