import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";
import { FichaCliente } from "@/features/clientes/ficha";

export const metadata: Metadata = { title: "Cliente" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const ESTADOS = ["pendiente", "abonada", "pagada", "anulada"];

export default async function PaginaCliente({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const filtros = {
    estado: ESTADOS.includes(t(sp.estado)) ? t(sp.estado) : "", moneda: t(sp.moneda),
    desde: fecha(t(sp.desde)), hasta: fecha(t(sp.hasta)),
  };
  const supabase = await crearClienteServidor();

  const columnasFactura = "id, origen, numero, numero_externo, fecha, moneda, total, pagado, saldo, estado, estado_pago, observaciones, soporte_url, soporte_path, motivo_anulacion";
  let facturasQ = supabase.from("facturas").select(columnasFactura).eq("cliente_id", id).neq("estado", "borrador")
    .order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000);
  if (filtros.estado) facturasQ = facturasQ.eq("estado_pago", filtros.estado);
  if (filtros.moneda) facturasQ = facturasQ.eq("moneda", filtros.moneda);
  if (filtros.desde) facturasQ = facturasQ.gte("fecha", filtros.desde);
  if (filtros.hasta) facturasQ = facturasQ.lte("fecha", filtros.hasta);

  const [{ data: cliente }, { data: saldos }, { data: resumen }, { data: facturas }, { data: pendientes }, { data: pagos }, { data: empaques }, { data: metodos }, { data: monedas }, { data: empresa }] =
    await Promise.all([
      supabase.from("clientes").select("id, numero, nombre, documento, telefono, direccion, correo, notas, limite_credito, limite_moneda, activo").eq("id", id).maybeSingle(),
      supabase.from("v_saldos_clientes_moneda").select("*").eq("cliente_id", id),
      supabase.from("v_resumen_clientes").select("estado, cajas_retiradas, cajas_devueltas, cajas_pendientes").eq("id", id).maybeSingle(),
      facturasQ,
      supabase.from("facturas").select("id, origen, numero, numero_externo, fecha, moneda, total, saldo").eq("cliente_id", id).eq("estado", "emitida").order("fecha"),
      supabase.from("pagos_clientes").select("id, numero, fecha, moneda, monto, tipo, metodo_id, referencia, nota, created_at, metodos_pago(nombre), pago_aplicaciones(factura_id, monto)")
        .eq("cliente_id", id).order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000),
      supabase.from("empaques_clientes").select("id, fecha, retiradas, devueltas, factura_id, nota").eq("cliente_id", id).order("fecha", { ascending: false }).order("id", { ascending: false }),
      supabase.from("metodos_pago").select("id, nombre").eq("activo", true).order("orden"),
      supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
      supabase.from("empresa").select("factura_prefijo").eq("id", 1).single(),
    ]);
  if (!cliente) notFound();

  // Enlaces temporales para los soportes guardados en Storage
  const rutas = (facturas ?? []).map((f) => f.soporte_path).filter((r): r is string => Boolean(r));
  const firmadas: Record<string, string> = {};
  if (rutas.length) {
    const { data } = await supabase.storage.from("facturas").createSignedUrls(rutas, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) firmadas[f.path] = f.signedUrl;
  }

  return (
    <FichaCliente
      cliente={{ ...cliente, numero: cliente.numero ?? 0 }}
      estado={resumen?.estado ?? "AL DÍA"}
      cajas={{ retiradas: Number(resumen?.cajas_retiradas ?? 0), devueltas: Number(resumen?.cajas_devueltas ?? 0), pendientes: Number(resumen?.cajas_pendientes ?? 0) }}
      saldos={(saldos ?? []).map((s) => ({
        moneda: s.moneda!, pendiente: Number(s.pendiente_facturas ?? 0), aFavor: Number(s.saldo_a_favor ?? 0),
        saldo: Number(s.saldo ?? 0), facturas: Number(s.facturas_pendientes ?? 0),
      }))}
      facturas={(facturas ?? []).map((f) => ({ ...f, saldo: Number(f.saldo ?? 0), estado_pago: f.estado_pago ?? "pendiente", soporte: f.soporte_path ? firmadas[f.soporte_path] ?? null : f.soporte_url }))}
      pendientes={(pendientes ?? []).map((f) => ({ ...f, saldo: Number(f.saldo ?? 0) }))}
      pagos={pagos ?? []}
      empaques={empaques ?? []}
      metodos={metodos ?? []}
      monedas={(monedas ?? []).map((m) => m.codigo)}
      prefijo={empresa?.factura_prefijo ?? ""}
      filtros={filtros}
      hoy={hoyISO()}
      permisos={{
        editar: puede(perfil.rol, "gestionar_clientes"),
        cobrar: puede(perfil.rol, "cobrar"),
        facturar: puede(perfil.rol, "facturar"),
        eliminar: puede(perfil.rol, "configuracion"),
        esAdmin: perfil.rol === "admin",
      }}
    />
  );
}
