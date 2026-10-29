import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { PERIODOS, rangoPeriodo, type ClavePeriodo } from "@/lib/periodos";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoHoja, Hoja } from "@/components/comunes/hoja";
import { BotonImprimir } from "@/features/proveedores/controles-estado-cuenta";
import { FiltrosDashboard } from "@/features/dashboard/filtros";
import { esTipoReporte, generarReporte, REPORTES } from "@/features/reportes/definiciones";
import { TablaReporte } from "@/features/reportes/tabla";
import { FiltroSaldosProveedores } from "@/features/reportes/filtro-saldos-proveedores";

export const metadata: Metadata = { title: "Reporte" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function PaginaReporte({ params, searchParams }: PageProps<"/reportes/[tipo]">) {
  await exigirPerfil("ver_dashboard");
  const tipo = (await params).tipo;
  if (!esTipoReporte(tipo)) notFound();
  const sp = await searchParams;
  const desdeQ = fecha(t(sp.desde)), hastaQ = fecha(t(sp.hasta));
  // Si vienen fechas sin periodo (p. ej. desde el dashboard) se toma como rango
  const clave = (PERIODOS.some(([v]) => v === t(sp.p)) ? t(sp.p) : desdeQ ? "rango" : "mes") as ClavePeriodo;
  const { actual } = rangoPeriodo(clave, hoyISO(), { desde: desdeQ, hasta: hastaQ });
  const supabase = await crearClienteServidor();
  const [{ data: monedas }, { data: empresa }] = await Promise.all([
    supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
    supabase.from("empresa").select("razon_social, rif, direccion, telefonos, logo_path, moneda_defecto").eq("id", 1).single(),
  ]);
  const lista = (monedas ?? []).map((m) => m.codigo);
  const moneda = lista.includes(t(sp.moneda)) ? t(sp.moneda) : empresa?.moneda_defecto ?? "USD";
  const def = REPORTES[tipo];
  // Filtro por proveedor (solo en los reportes que lo usan)
  const { data: proveedores } = def.proveedor
    ? await supabase.from("proveedores").select("id, nombre").order("nombre")
    : { data: null };
  const prov = (proveedores ?? []).find((p) => String(p.id) === t(sp.proveedor));
  // Saldos de proveedores: fruta que traen, proveedores elegidos y solo con saldo
  const rubroId = def.eleccion ? Number(t(sp.rubro)) || null : null;
  const seleccion = def.eleccion ? t(sp.sel).split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const soloConSaldo = def.eleccion && t(sp.saldo) === "1";
  const [{ data: rubros }, { data: candidatos }] = def.eleccion
    ? await Promise.all([
        supabase.from("productos").select("id, nombre").eq("categoria", "fruta").neq("tipo", "terminado").eq("activo", true).order("nombre"),
        supabase.rpc("buscar_proveedores", { ...(rubroId ? { p_producto: rubroId } : {}) }),
      ])
    : [{ data: null }, { data: null }];
  const rubro = (rubros ?? []).find((x) => x.id === rubroId);
  // Ventas a un cliente: el cliente elegido
  const { data: clientes } = def.cliente
    ? await supabase.from("clientes").select("id, numero, nombre").eq("activo", true).order("nombre").limit(5000)
    : { data: null };
  const cli = (clientes ?? []).find((c) => String(c.id) === t(sp.cliente));
  const r = await generarReporte(tipo, { ...actual, moneda, proveedorId: prov?.id ?? null, rubroId, seleccion, soloConSaldo, clienteId: cli?.id ?? null });
  const qs = new URLSearchParams({ desde: actual.desde, hasta: actual.hasta, ...(def.moneda ? { moneda } : {}), ...(prov ? { proveedor: String(prov.id) } : {}),
    ...(rubroId ? { rubro: String(rubroId) } : {}), ...(seleccion.length ? { sel: seleccion.join(",") } : {}), ...(soloConSaldo ? { saldo: "1" } : {}), ...(cli ? { cliente: String(cli.id) } : {}) });

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <Link href="/reportes" className="mr-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Reportes</Link>
        <a href={`/reportes/${tipo}/excel?${qs}`} className={buttonVariants({ variant: "outline" })}><Download className="size-4" /> Excel</a>
        <BotonImprimir />
      </div>
      {def.eleccion && (
        <FiltroSaldosProveedores rubros={rubros ?? []} rubro={rubroId ? String(rubroId) : ""} seleccion={seleccion} soloConSaldo={soloConSaldo}
          proveedores={(candidatos ?? []).flatMap((x) => (x.id !== null && x.nombre ? [{ id: x.id, nombre: x.nombre }] : []))} />
      )}
      {def.periodo && <div className="no-print"><FiltrosDashboard periodo={clave} desde={actual.desde} hasta={actual.hasta} moneda={moneda} monedas={lista} conMoneda={def.moneda}
        proveedores={proveedores ?? undefined} proveedor={prov ? String(prov.id) : ""}
        clientes={clientes ?? undefined} cliente={cli ? String(cli.id) : ""} /></div>}
      <Hoja>
        <EncabezadoHoja empresa={empresa} titulo={r.titulo.toUpperCase()}
          lineas={def.periodo
            ? [`Del ${formatearFecha(actual.desde)} al ${formatearFecha(actual.hasta)}`, r.moneda ? `Moneda: ${r.moneda}` : "", prov ? `Proveedor: ${prov.nombre}` : "",
              cli ? `Cliente: ${cli.numero ? `${cli.numero} · ` : ""}${cli.nombre}` : "", ...(r.lineas ?? [])]
            : [`Al ${formatearFecha(hoyISO())}`, rubro ? `Proveedores que traen ${rubro.nombre}` : "", seleccion.length ? `${seleccion.length} proveedores elegidos` : "",
              soloConSaldo ? "Solo a los que se les debe" : ""]} />
        <div className="mt-4">
          <TablaReporte columnas={r.columnas} filas={r.filas} totales={r.totales} moneda={r.moneda} />
        </div>
        {r.nota && <p className="mt-3 text-xs text-neutral-500">{r.nota}</p>}
      </Hoja>
    </>
  );
}
