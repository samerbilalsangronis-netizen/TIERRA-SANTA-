import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelProductos } from "@/features/catalogos/panel-productos";

export const metadata: Metadata = { title: "Productos" };

export default async function PaginaProductos() {
  const supabase = await crearClienteServidor();
  const [{ data: productos }, { data: unidades }] = await Promise.all([
    supabase.from("productos").select("id, codigo, nombre, emoji, unidad, tipo, categoria, modo_pesaje, kg_por_cesta, stock_minimo, activo, notas").order("codigo"),
    supabase.from("unidades").select("codigo, nombre").eq("activa", true).order("nombre"),
  ]);
  return <PanelProductos productos={productos ?? []} unidades={unidades ?? []} />;
}
