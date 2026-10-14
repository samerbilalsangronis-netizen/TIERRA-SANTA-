import Image from "next/image";
import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/env";
import { urlLogo } from "@/lib/empresa";
import { FormularioLogin } from "@/features/auth/formulario-login";

export const metadata: Metadata = { title: "Iniciar sesión" };

const MENSAJES_SALIDA: Record<string, string> = {
  bloqueado: "Tu usuario fue BLOQUEADO. Comunícate con el administrador.",
  inactivo: "Tu usuario está INACTIVO. Comunícate con el administrador.",
  vencido: "Tu suscripción venció. Comunícate con el administrador.",
  sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

async function datosEmpresa() {
  if (!supabaseConfigurado()) return { razon: "Procesadora de Alimentos Tierra Santa", logo: urlLogo(null) };
  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.rpc("empresa_publica");
    const fila = data?.[0];
    return {
      razon: fila?.razon_social || "Procesadora de Alimentos Tierra Santa",
      logo: urlLogo(fila?.logo_path),
    };
  } catch {
    return { razon: "Procesadora de Alimentos Tierra Santa", logo: urlLogo(null) };
  }
}

export default async function PaginaInicio({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const motivo = typeof params.motivo === "string" ? params.motivo : undefined;
  const siguiente = typeof params.siguiente === "string" ? params.siguiente : undefined;
  const { razon, logo } = await datosEmpresa();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] px-5 py-10 text-[#ececf3]">
      {/* Halo suave de marca detrás del logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] size-[min(110vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,.55) 0%, rgba(124,58,237,0) 65%)" }}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="anim-logo relative aspect-[1775/1028] w-[min(88vw,460px)]">
          <Image src={logo} alt={razon} fill priority sizes="(max-width: 640px) 88vw, 460px" className="object-contain drop-shadow-[0_8px_36px_rgba(157,92,246,.55)]" unoptimized={logo.startsWith("http")} />
        </div>

        <div className="anim-form mt-8 w-full max-w-sm">
          {!supabaseConfigurado() ? (
            <p className="rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-4 text-sm text-[#fbbf24]">
              Falta configurar Supabase. Copia <code>.env.example</code> a <code>.env.local</code> y completa las claves (ver README).
            </p>
          ) : (
            <FormularioLogin siguiente={siguiente} avisoInicial={motivo ? MENSAJES_SALIDA[motivo] : undefined} />
          )}
        </div>
      </div>

      <footer className="anim-form relative z-10 mt-10 text-center text-xs text-[#9a99ad]">
        <p>{razon}</p>
        <p>© {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
