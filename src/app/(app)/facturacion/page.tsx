import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { ModuloPendiente } from "@/components/comunes/modulo-en-construccion";

export const metadata: Metadata = { title: "Facturación" };

export default async function Pagina() {
  await exigirPerfil("facturar");
  return (
    <ModuloPendiente titulo="Facturación" fase={5} icono={FileText}
      detalle="Emisión transaccional, buscador por número de cliente, código de producto, IVA, PDF profesional, edición con versiones y anulación." />
  );
}
