import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { ModuloPendiente } from "@/components/comunes/modulo-en-construccion";

export const metadata: Metadata = { title: "Proveedores" };

export default async function Pagina() {
  await exigirPerfil("ver_dashboard");
  return (
    <ModuloPendiente titulo="Proveedores" fase={3} icono={Truck}
      detalle="Entregas FIJO/VARIABLE con merma, abonos, cestas y saldos por moneda, con buscador y agrupación A–Z." />
  );
}
