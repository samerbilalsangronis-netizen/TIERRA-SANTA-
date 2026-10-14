import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelUnidades } from "@/features/catalogos/panel-unidades";

export const metadata: Metadata = { title: "Unidades" };

export default async function PaginaUnidades() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("unidades").select("codigo, nombre, plural, activa").order("nombre");
  return <PanelUnidades unidades={data ?? []} />;
}
