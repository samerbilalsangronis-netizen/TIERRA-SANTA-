import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { ModuloPendiente } from "@/components/comunes/modulo-en-construccion";

export const metadata: Metadata = { title: "Reportes" };

export default async function Pagina() {
  await exigirPerfil("ver_dashboard");
  return (
    <ModuloPendiente titulo="Reportes" fase={8} icono={BarChart3}
      detalle="Ventas, libro de facturas, estados de cuenta, antigüedad, compras, kardex, producción y nómina con exportación a PDF/Excel." />
  );
}
