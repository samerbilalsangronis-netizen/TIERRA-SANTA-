"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CampoTexto } from "@/components/comunes/campos";
import { cambiarClavePropia, cerrarSesion } from "./acciones";
import { esquemaCambioClave, type DatosCambioClave } from "./esquemas";

export function FormularioCambioClave({ obligatorio }: { obligatorio: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const form = useForm<DatosCambioClave>({
    resolver: zodResolver(esquemaCambioClave),
    defaultValues: { clave: "", confirmar: "" },
  });

  const enviar = form.handleSubmit((datos) =>
    iniciar(async () => {
      const r = await cambiarClavePropia(datos);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensaje);
      router.replace("/dashboard");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <CampoTexto etiqueta="Nueva contraseña" type="password" autoComplete="new-password"
        error={form.formState.errors.clave?.message} ayuda="Mínimo 8 caracteres, con letras y números."
        {...form.register("clave")} />
      <CampoTexto etiqueta="Confirmar contraseña" type="password" autoComplete="new-password"
        error={form.formState.errors.confirmar?.message} {...form.register("confirmar")} />
      <div className="flex gap-2">
        {obligatorio ? (
          <Button type="button" variant="outline" className="flex-1" onClick={() => cerrarSesion()}>Salir</Button>
        ) : (
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>Cancelar</Button>
        )}
        <Button type="submit" className="flex-1" disabled={pendiente}>
          {pendiente && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </form>
  );
}
