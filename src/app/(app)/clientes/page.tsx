import type { Metadata } from "next";
import { Users } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { ModuloPendiente } from "@/components/comunes/modulo-en-construccion";

export const metadata: Metadata = { title: "Clientes" };

export default async function Pagina() {
  await exigirPerfil("ver_dashboard");
  return (
    <ModuloPendiente titulo="Clientes" fase={4} icono={Users}
      detalle="Ficha del cliente, facturas, pagos aplicados factura por factura, empaques, saldos por moneda y estado de cuenta." />
  );
}
