import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlLogo } from "@/lib/empresa";
import { formatearFechaLarga } from "@/lib/fechas";
import { BarraLateral } from "@/components/app/barra-lateral";
import { BarraSuperior } from "@/components/app/barra-superior";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const perfil = await exigirPerfil();
  const supabase = await crearClienteServidor();
  const { data: empresa } = await supabase.from("empresa").select("razon_social, logo_path").eq("id", 1).maybeSingle();
  const logo = urlLogo(empresa?.logo_path);
  const razon = empresa?.razon_social ?? "Procesadora de Alimentos Tierra Santa";

  return (
    <div className="min-h-dvh bg-background">
      <BarraLateral rol={perfil.rol} logo={logo} razon={razon} />
      <div className="lg:pl-64 print:pl-0">
        <BarraSuperior
          nombre={perfil.nombre}
          usuario={perfil.email}
          rol={perfil.rol}
          logo={logo}
          razon={razon}
          fechaHoy={formatearFechaLarga()}
        />
        <main className="mx-auto w-full max-w-[1400px] px-3 py-5 sm:px-6 sm:py-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
