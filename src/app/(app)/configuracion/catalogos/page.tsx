import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { EstadoVacio } from "@/components/comunes/estado-vacio";

export const metadata: Metadata = { title: "Catálogos" };

export default async function PaginaCatalogos() {
  await exigirPerfil("configuracion");
  return (
    <EstadoVacio icono={BookOpen} titulo="Los catálogos se administran desde la Fase 2"
      descripcion="Productos con código numérico, unidades, ubicaciones, monedas y tasas, métodos de pago y tareas de nómina. Ya existen en la base de datos con valores iniciales." />
  );
}
