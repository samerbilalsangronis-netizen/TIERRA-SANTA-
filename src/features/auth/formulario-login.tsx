"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarSesion } from "./acciones";
import { esquemaLogin, type DatosLogin } from "./esquemas";

export function FormularioLogin({ siguiente, avisoInicial }: { siguiente?: string; avisoInicial?: string }) {
  const router = useRouter();
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(avisoInicial ?? null);
  const [pendiente, iniciar] = useTransition();
  const form = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { usuario: "", clave: "", siguiente },
  });

  useEffect(() => {
    form.setFocus("usuario");
  }, [form]);

  const enviar = form.handleSubmit((datos) => {
    setError(null);
    iniciar(async () => {
      const r = await iniciarSesion(datos);
      if (!r.ok) {
        setError(r.error);
        form.setValue("clave", "");
        form.setFocus("clave");
        return;
      }
      const dias = r.datos.diasRestantes;
      if (dias !== null && dias <= 7) {
        toast.warning(
          dias === 0 ? "Tu suscripción vence HOY." : `Tu suscripción vence en ${dias} día${dias === 1 ? "" : "s"}.`,
          { duration: 8000 },
        );
      }
      router.replace(r.datos.destino);
      router.refresh();
    });
  });

  const errores = form.formState.errors;

  return (
    <form onSubmit={enviar} noValidate className="space-y-4 rounded-2xl border border-white/10 bg-[#111118]/80 p-5 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="space-y-1.5">
        <Label htmlFor="usuario" className="text-[#c9c8d6]">Usuario</Label>
        <Input
          id="usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu.usuario"
          className="h-11 border-white/10 bg-[#0a0a0f] text-base text-white placeholder:text-[#5f5e70]"
          aria-invalid={!!errores.usuario}
          {...form.register("usuario")}
        />
        {errores.usuario && <p className="text-xs text-[#f87171]">{errores.usuario.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clave" className="text-[#c9c8d6]">Contraseña</Label>
        <div className="relative">
          <Input
            id="clave"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 border-white/10 bg-[#0a0a0f] pr-11 text-base text-white placeholder:text-[#5f5e70]"
            aria-invalid={!!errores.clave}
            {...form.register("clave")}
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#9a99ad] hover:text-white"
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errores.clave && <p className="text-xs text-[#f87171]">{errores.clave.message}</p>}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 p-3 text-sm text-[#fca5a5]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={pendiente} className="h-11 w-full bg-[#7c3aed] text-base font-semibold text-white hover:bg-[#6d28d9]">
        {pendiente ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        {pendiente ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
