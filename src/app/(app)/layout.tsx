import { AlertTriangle } from "lucide-react";
import { exigirPerfil, diasParaVencer } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlLogo } from "@/lib/empresa";
import { formatearFecha, formatearFechaLarga } from "@/lib/fechas";
import { BarraLateral } from "@/components/app/barra-lateral";
import { BarraSuperior } from "@/components/app/barra-superior";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const perfil = await exigirPerfil();
  const supabase = await crearClienteServidor();
  const { data: empresa } = await supabase.from("empresa").select("razon_social, logo_path").eq("id", 1).maybeSingle();
  const logo = urlLogo(empresa?.logo_path);
  const razon = empresa?.razon_social ?? "Procesadora de Alimentos Tierra Santa";
  const dias = diasParaVencer(perfil.vence_el);

  return (
    <div className="min-h-dvh bg-background">
      <BarraLateral rol={perfil.rol} logo={logo} razon={razon} />
      <div className="lg:pl-64">
        <BarraSuperior
          nombre={perfil.nombre}
          usuario={perfil.usuario}
          rol={perfil.rol}
          logo={logo}
          razon={razon}
          fechaHoy={formatearFechaLarga()}
        />
        {dias !== null && dias <= 7 && (
          <div className="no-print flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning sm:px-6">
            <AlertTriangle className="size-4 shrink-0" />
            {dias === 0
              ? "Tu suscripción vence HOY."
              : `Tu suscripción vence en ${dias} día${dias === 1 ? "" : "s"} (${formatearFecha(perfil.vence_el)}).`}
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] px-3 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
