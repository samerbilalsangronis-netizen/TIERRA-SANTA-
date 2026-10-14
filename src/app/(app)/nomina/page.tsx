import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { ModuloPendiente } from "@/components/comunes/modulo-en-construccion";

export const metadata: Metadata = { title: "Nómina" };

export default async function Pagina() {
  await exigirPerfil("nomina");
  return (
    <ModuloPendiente titulo="Nómina" fase={7} icono={Wallet}
      detalle="Empleados fijos y por tarea, calendario de jornadas, abonos, periodos y recibos." />
  );
}
