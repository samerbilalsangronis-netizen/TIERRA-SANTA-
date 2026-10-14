import { Construction } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EncabezadoPagina } from "./encabezado";
import { EstadoVacio } from "./estado-vacio";

/** Página temporal para módulos de fases posteriores. */
export function ModuloPendiente({ titulo, fase, icono, detalle }: { titulo: string; fase: number; icono: LucideIcon; detalle: string }) {
  return (
    <>
      <EncabezadoPagina titulo={titulo} icono={icono} />
      <EstadoVacio icono={Construction} titulo={`Este módulo se entrega en la Fase ${fase}`} descripcion={detalle} />
    </>
  );
}
