import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelMetodos } from "@/features/catalogos/panel-metodos";

export const metadata: Metadata = { title: "Métodos de pago" };

export default async function PaginaMetodos() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("metodos_pago").select("id, nombre, activo, orden").order("orden").order("nombre");
  return <PanelMetodos metodos={data ?? []} />;
}
