import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { obtenerPerfil } from "@/lib/auth/sesion";
import { FormularioCambioClave } from "@/features/auth/formulario-cambio-clave";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default async function PaginaCambiarClave() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold">Cambiar contraseña</h1>
            <p className="text-sm text-muted-foreground">Hola, {perfil.nombre || perfil.usuario}</p>
          </div>
        </div>
        {perfil.debe_cambiar_clave && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Por seguridad debes crear una contraseña nueva antes de continuar.
          </p>
        )}
        <FormularioCambioClave obligatorio={perfil.debe_cambiar_clave} />
      </div>
    </main>
  );
}
