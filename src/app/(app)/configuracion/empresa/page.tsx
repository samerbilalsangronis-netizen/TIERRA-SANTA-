import type { Metadata } from "next";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlLogo } from "@/lib/empresa";
import { FormularioEmpresa } from "@/features/configuracion/formulario-empresa";
import type { DatosEmpresaValidos } from "@/features/configuracion/esquemas";

export const metadata: Metadata = { title: "Empresa" };

export default async function PaginaEmpresa() {
  await exigirPerfil("configuracion");
  const supabase = await crearClienteServidor();
  const [{ data: e }, { data: monedas }, { data: ubicaciones }] = await Promise.all([
    supabase.from("empresa").select("*").eq("id", 1).single(),
    supabase.from("monedas").select("codigo, nombre").eq("activa", true).order("orden"),
    supabase.from("ubicaciones").select("id, nombre").eq("activa", true).order("nombre"),
  ]);
  if (!e) throw new Error("No se encontró la configuración de la empresa.");

  const inicial: DatosEmpresaValidos = {
    razon_social: e.razon_social, rif: e.rif, direccion: e.direccion, telefonos: e.telefonos, correo: e.correo,
    pie_factura: e.pie_factura, texto_legal: e.texto_legal, titulo_documento: e.titulo_documento,
    iva_pct: Number(e.iva_pct), moneda_defecto: e.moneda_defecto, factura_prefijo: e.factura_prefijo,
    factura_numero_inicial: Number(e.factura_numero_inicial),
    stock_insuficiente: e.stock_insuficiente as DatosEmpresaValidos["stock_insuficiente"],
    cambio_moneda_con_pagos: e.cambio_moneda_con_pagos as DatosEmpresaValidos["cambio_moneda_con_pagos"],
    roles_editan_factura: e.roles_editan_factura,
    entregas_suman_inventario: e.entregas_suman_inventario, entregas_ubicacion_id: e.entregas_ubicacion_id,
    lotes_activos: e.lotes_activos,
    nomina_periodicidad: e.nomina_periodicidad as DatosEmpresaValidos["nomina_periodicidad"],
    nomina_inicio_semana: e.nomina_inicio_semana,
  };

  return (
    <FormularioEmpresa
      inicial={inicial}
      logoUrl={urlLogo(e.logo_path)}
      tieneLogoPropio={Boolean(e.logo_path)}
      monedas={(monedas ?? []).map((m) => ({ valor: m.codigo, etiqueta: `${m.codigo} · ${m.nombre}` }))}
      ubicaciones={(ubicaciones ?? []).map((u) => ({ valor: String(u.id), etiqueta: u.nombre }))}
    />
  );
}
