import { Settings } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { PestanasConfiguracion } from "@/features/configuracion/pestanas";

export default async function LayoutConfiguracion({ children }: LayoutProps<"/configuracion">) {
  const perfil = await exigirPerfil();
  return (
    <>
      <EncabezadoPagina icono={Settings} titulo="Configuración" descripcion="Empresa, usuarios, catálogos y bitácora." />
      <PestanasConfiguracion esAdmin={puede(perfil.rol, "configuracion")} />
      <div className="mt-4">{children}</div>
    </>
  );
}
