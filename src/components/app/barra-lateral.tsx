"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { puede, type Rol } from "@/lib/auth/roles";
import { NAVEGACION } from "./navegacion";

const LOGO_BLANCO = "/logo-tierra-santa.png";
const LOGO_NEGRO = "/logo-tierra-santa-negro.png";

export function MenuNavegacion({ rol, alNavegar }: { rol: Rol; alNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      {NAVEGACION.filter((i) => puede(rol, i.permiso)).map((item) => {
        const activo = ruta === item.href || ruta.startsWith(`${item.href}/`);
        const Icono = item.icono;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={alNavegar}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              activo && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]",
            )}
          >
            <Icono className={cn("size-[18px] shrink-0", activo ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground")} />
            {item.titulo}
          </Link>
        );
      })}
    </nav>
  );
}

export function MarcaLateral({ logo, razon }: { logo: string; razon: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-2">
      <div className="relative h-9 w-16 shrink-0">
        {logo === LOGO_BLANCO ? (
          <>
            <Image src={LOGO_NEGRO} alt="" fill sizes="64px" className="object-contain dark:hidden" />
            <Image src={LOGO_BLANCO} alt="" fill sizes="64px" className="hidden object-contain dark:block" />
          </>
        ) : (
          <Image src={logo} alt="" fill sizes="64px" className="object-contain" unoptimized={logo.startsWith("http")} />
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="font-heading text-sm font-bold tracking-wide">
          Tierra<span className="text-primary">Santa</span>
        </p>
        <p className="truncate text-[11px] text-muted-foreground" title={razon}>Sistema de gestión</p>
      </div>
    </Link>
  );
}

export function BarraLateral({ rol, logo, razon }: { rol: Rol; logo: string; razon: string }) {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
      <MarcaLateral logo={logo} razon={razon} />
      <div className="mt-6 flex-1 overflow-y-auto">
        <MenuNavegacion rol={rol} />
      </div>
      <p className="px-3 text-[11px] text-muted-foreground">© {new Date().getFullYear()} Tierra Santa</p>
    </aside>
  );
}
