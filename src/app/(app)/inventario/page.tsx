import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { ModuloPendiente } from "@/components/comunes/modulo-en-construccion";

export const metadata: Metadata = { title: "Inventario" };

export default async function Pagina() {
  await exigirPerfil("ver_dashboard");
  return (
    <ModuloPendiente titulo="Inventario" fase={6} icono={Boxes}
      detalle="Producción diaria, salidas por factura, entradas por compra, traslados, ajustes, kardex y alertas." />
  );
}
