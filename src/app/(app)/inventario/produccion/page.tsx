import type { Metadata } from "next";
import { exigirPerfil } from "@/lib/auth/sesion";
import { hoyISO } from "@/lib/fechas";
import { cargarStock } from "@/features/inventario/datos";
import { FormularioProduccion } from "@/features/inventario/formulario-produccion";

export const metadata: Metadata = { title: "Registrar producción" };

export default async function PaginaProduccion() {
  const perfil = await exigirPerfil("inventario_operar");
  const { filas, ubicaciones } = await cargarStock();
  return (
    <FormularioProduccion hoy={hoyISO()} responsable={perfil.nombre} ubicaciones={ubicaciones}
      productos={filas.filter((f) => f.activo).map((f) => ({ id: f.id, codigo: f.codigo, nombre: f.nombre, emoji: f.emoji, unidad: f.unidad, total: f.total }))} />
  );
}
