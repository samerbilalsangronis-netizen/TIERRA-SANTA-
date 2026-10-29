import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelConceptosGasto } from "@/features/catalogos/panel-conceptos-gasto";

export const metadata: Metadata = { title: "Conceptos de gastos" };

export default async function PaginaConceptosGasto() {
  const supabase = await crearClienteServidor();
  const [{ data: conceptos }, { data: categorias }, { data: unidades }] = await Promise.all([
    supabase.from("conceptos_gasto").select("id, nombre, categoria_id, unidad, activo, categorias_gasto(nombre, orden)").order("nombre"),
    supabase.from("categorias_gasto").select("id, nombre").eq("activa", true).order("orden").order("nombre"),
    supabase.from("unidades").select("codigo, nombre").eq("activa", true).order("nombre"),
  ]);
  const filas = (conceptos ?? [])
    .map((c) => ({ id: c.id, nombre: c.nombre, categoria_id: c.categoria_id, unidad: c.unidad, activo: c.activo,
      categoria: c.categorias_gasto?.nombre ?? "", orden: c.categorias_gasto?.orden ?? 0 }))
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  return <PanelConceptosGasto conceptos={filas} categorias={categorias ?? []} unidades={unidades ?? []} />;
}
