import { exigirPerfil } from "@/lib/auth/sesion";
import { NavegacionCatalogos } from "@/features/catalogos/navegacion";

export default async function LayoutCatalogos({ children }: LayoutProps<"/configuracion/catalogos">) {
  await exigirPerfil("configuracion");
  return (
    <>
      <NavegacionCatalogos />
      {children}
    </>
  );
}
