"use client";
import { useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Menu, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NOMBRE_ROL, type Rol } from "@/lib/auth/roles";
import { cerrarSesion } from "@/features/auth/acciones";
import { SelectorTema } from "./selector-tema";
import { MarcaLateral, MenuNavegacion } from "./barra-lateral";

type Props = { nombre: string; usuario: string; rol: Rol; logo: string; razon: string; fechaHoy: string };

export function BarraSuperior({ nombre, usuario, rol, logo, razon, fechaHoy }: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const iniciales = (nombre || usuario).split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
        <Menu className="size-5" />
      </Button>
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" className="w-72 bg-sidebar p-3">
          <SheetHeader className="p-1">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <MarcaLateral logo={logo} razon={razon} />
          </SheetHeader>
          <div className="mt-2">
            <MenuNavegacion rol={rol} alNavegar={() => setMenuAbierto(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <p className="hidden text-sm text-muted-foreground first-letter:uppercase sm:block">{fechaHoy}</p>
      <div className="ml-auto flex items-center gap-1">
        <SelectorTema />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-10 gap-2 px-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {iniciales}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium">{nombre || usuario}</span>
                  <span className="block text-[11px] text-muted-foreground">{NOMBRE_ROL[rol]}</span>
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="flex items-center gap-2"><UserRound className="size-4" /> {usuario}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/auth/cambiar-clave" />}>
              <KeyRound className="size-4" /> Cambiar contraseña
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => cerrarSesion()}>
              <LogOut className="size-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
