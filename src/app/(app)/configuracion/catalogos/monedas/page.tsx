import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";
import { PanelMonedas } from "@/features/catalogos/panel-monedas";

export const metadata: Metadata = { title: "Monedas y tasas" };

export default async function PaginaMonedas() {
  const supabase = await crearClienteServidor();
  const [{ data: monedas }, { data: tasas }] = await Promise.all([
    supabase.from("monedas").select("codigo, nombre, simbolo, decimales, activa, orden").order("orden"),
    supabase.from("tasas_cambio").select("id, fecha, moneda_origen, moneda_destino, tasa, nota")
      .order("fecha", { ascending: false }).order("id", { ascending: false }).limit(60),
  ]);
  return <PanelMonedas monedas={monedas ?? []} tasas={tasas ?? []} hoy={hoyISO()} />;
}
