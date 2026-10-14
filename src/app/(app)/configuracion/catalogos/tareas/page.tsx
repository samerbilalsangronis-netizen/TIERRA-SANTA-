import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelTareas } from "@/features/catalogos/panel-tareas";

export const metadata: Metadata = { title: "Tareas de nómina" };

export default async function PaginaTareas() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("tareas_nomina").select("id, emoji, nombre, valor, unidad, activa, orden").order("orden").order("nombre");
  return <PanelTareas tareas={data ?? []} />;
}
