import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";
import { FichaProveedor } from "@/features/proveedores/ficha";

export const metadata: Metadata = { title: "Proveedor" };

const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function PaginaProveedor({ params, searchParams }: PageProps<"/proveedores/[id]">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const filtros = { moneda: t(sp.moneda), desde: fecha(t(sp.desde)), hasta: fecha(t(sp.hasta)) };

  const supabase = await crearClienteServidor();
  let entregasQ = supabase.from("entregas_proveedor")
    .select("id, fecha, producto_id, moneda, modo_pesaje, kg_por_cesta, cestas, kg_total, unidades, precio, merma, precio_kg, desc_merma, total, peso_neto, foto_url, foto_path, nota, productos(codigo, nombre, emoji, unidad, categoria)")
    .eq("proveedor_id", id).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000);
  let abonosQ = supabase.from("abonos_proveedor")
    .select("id, numero, fecha, moneda, monto, metodo_id, referencia, pagado_por, nota, metodos_pago(nombre)")
    .eq("proveedor_id", id).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000);
  let cestasQ = supabase.from("cestas_proveedor").select("id, fecha, entregadas, devueltas, entrega_id, nota")
    .eq("proveedor_id", id).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000);
  if (filtros.moneda) { entregasQ = entregasQ.eq("moneda", filtros.moneda); abonosQ = abonosQ.eq("moneda", filtros.moneda); }
  if (filtros.desde) { entregasQ = entregasQ.gte("fecha", filtros.desde); abonosQ = abonosQ.gte("fecha", filtros.desde); cestasQ = cestasQ.gte("fecha", filtros.desde); }
  if (filtros.hasta) { entregasQ = entregasQ.lte("fecha", filtros.hasta); abonosQ = abonosQ.lte("fecha", filtros.hasta); cestasQ = cestasQ.lte("fecha", filtros.hasta); }

  const [{ data: proveedor }, { data: resumen }, { data: saldos }, { data: entregas }, { data: abonos }, { data: cestas }, { data: rubros }, { data: monedas }, { data: metodos }] =
    await Promise.all([
      supabase.from("proveedores").select("id, nombre, documento, telefono, ubicacion, moneda_habitual, tipo, notas, activo").eq("id", id).maybeSingle(),
      supabase.from("v_resumen_proveedores").select("cestas_pendientes, cestas_entregadas, cestas_devueltas, ultima_entrega").eq("id", id).maybeSingle(),
      supabase.from("v_saldos_proveedores_moneda").select("*").eq("proveedor_id", id),
      entregasQ, abonosQ, cestasQ,
      supabase.from("productos").select("id, codigo, nombre, emoji, categoria, modo_pesaje, kg_por_cesta, unidad").neq("tipo", "terminado").eq("activo", true).order("nombre"),
      supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
      supabase.from("metodos_pago").select("id, nombre").eq("activo", true).order("orden"),
    ]);
  if (!proveedor) notFound();

  // URLs firmadas (1 h) para las fotos guardadas en Storage
  const rutas = (entregas ?? []).map((e) => e.foto_path).filter((r): r is string => Boolean(r));
  const firmadas: Record<string, string> = {};
  if (rutas.length) {
    const { data } = await supabase.storage.from("entregas").createSignedUrls(rutas, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) firmadas[f.path] = f.signedUrl;
  }
  const conCestas = new Set((cestas ?? []).map((c) => c.entrega_id).filter(Boolean));

  return (
    <FichaProveedor
      proveedor={proveedor}
      resumen={resumen}
      saldos={saldos ?? []}
      entregas={(entregas ?? []).map((e) => ({
        ...e,
        foto_firmada: e.foto_path ? firmadas[e.foto_path] ?? null : e.foto_url,
        tiene_cestas: conCestas.has(e.id),
      }))}
      abonos={abonos ?? []}
      cestas={cestas ?? []}
      rubros={(rubros ?? []).filter((r) =>
        proveedor.tipo === "ambos" || (proveedor.tipo === "insumos" ? r.categoria === "insumo" : r.categoria === "fruta"))}
      monedas={(monedas ?? []).map((m) => m.codigo)}
      metodos={metodos ?? []}
      filtros={filtros}
      hoy={hoyISO()}
      permisos={{
        editar: puede(perfil.rol, "gestionar_proveedores"),
        pagar: puede(perfil.rol, "pagar_proveedores"),
        eliminarProveedor: puede(perfil.rol, "configuracion"),
      }}
    />
  );
}
