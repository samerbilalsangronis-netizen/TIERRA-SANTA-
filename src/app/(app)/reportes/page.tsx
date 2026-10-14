import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { REPORTES } from "@/features/reportes/definiciones";

export const metadata: Metadata = { title: "Reportes" };

export default async function PaginaReportes() {
  const perfil = await exigirPerfil("ver_dashboard");
  const otros: [string, string, string, boolean][] = [
    ["Antigüedad de saldos", "Lo que deben los clientes por días de atraso.", "/clientes/antiguedad", true],
    ["Estados de cuenta", "Por cliente o proveedor, desde su ficha.", "/clientes", true],
    ["Kardex e inventario", "Movimientos y stock de cada producto.", "/inventario", true],
    ["Nómina por periodo", "Resumen, recibos y Excel de cada periodo.", "/nomina/periodos", puede(perfil.rol, "nomina")],
  ];
  const fila = (titulo: string, descripcion: string, href: string) => (
    <li key={href}>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
        <div className="min-w-0 flex-1"><p className="font-medium">{titulo}</p><p className="text-xs text-muted-foreground">{descripcion}</p></div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </li>
  );
  return (
    <>
      <EncabezadoPagina icono={BarChart3} titulo="Reportes" descripcion="Elige un reporte: se ve en pantalla, se imprime (o guarda en PDF) y se descarga en Excel." />
      <ul className="mb-4 divide-y overflow-hidden rounded-2xl border bg-card">
        {Object.entries(REPORTES).map(([k, r]) => fila(r.titulo, r.descripcion, `/reportes/${k}`))}
      </ul>
      <p className="mb-2 text-sm font-medium text-muted-foreground">También en otras pantallas</p>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {otros.filter((o) => o[3]).map(([t, d, h]) => fila(t, d, h))}
      </ul>
    </>
  );
}
