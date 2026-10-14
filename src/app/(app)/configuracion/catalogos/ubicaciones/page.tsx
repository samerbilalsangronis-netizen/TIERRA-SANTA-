import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelUbicaciones } from "@/features/catalogos/panel-ubicaciones";

export const metadata: Metadata = { title: "Ubicaciones" };

export default async function PaginaUbicaciones() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("ubicaciones")
    .select("id, nombre, descripcion, es_cuarto_frio, predeterminada, activa").order("predeterminada", { ascending: false }).order("nombre");
  return <PanelUbicaciones ubicaciones={data ?? []} />;
}
