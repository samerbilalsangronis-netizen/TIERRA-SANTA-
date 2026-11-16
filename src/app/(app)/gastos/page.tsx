import type { Metadata } from "next";
import { Receipt, Tags } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { PERIODOS, rangoPeriodo, type ClavePeriodo } from "@/lib/periodos";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { FiltrosDashboard } from "@/features/dashboard/filtros";
import { Barras, Tarjeta } from "@/features/dashboard/componentes";
import { FiltrosUrl } from "@/features/inventario/dialogos";
import { cargarCatalogoGastos, cargarGastos } from "@/features/gastos/datos";
import { BotonNuevoGasto, ListaGastos } from "@/features/gastos/lista-gastos";

export const metadata: Metadata = { title: "Gastos" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function PaginaGastos({ searchParams }: PageProps<"/gastos">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const sp = await searchParams;
  const desdeQ = fecha(t(sp.desde)), hastaQ = fecha(t(sp.hasta));
  const clave = (PERIODOS.some(([v]) => v === t(sp.p)) ? t(sp.p) : desdeQ ? "rango" : "mes") as ClavePeriodo;
  const hoy = hoyISO();
  const { actual } = rangoPeriodo(clave, hoy, { desde: desdeQ, hasta: hastaQ });
  const catalogo = await cargarCatalogoGastos();
  const categoriaId = Number(t(sp.categoria)) || null;
  const conceptoId = Number(t(sp.concepto)) || null;
  const filas = await cargarGastos({ ...actual, categoriaId, conceptoId });

  // Totales por moneda y por categoría (de lo que se ve)
  const porMoneda = new Map<string, number>();
  const porCategoria = new Map<string, { nombre: string; montos: Map<string, number> }>();
  for (const g of filas) {
    porMoneda.set(g.moneda, (porMoneda.get(g.moneda) ?? 0) + g.monto);
    const c = porCategoria.get(String(g.categoria_id)) ?? { nombre: g.categoria, montos: new Map() };
    c.montos.set(g.moneda, (c.montos.get(g.moneda) ?? 0) + g.monto);
    porCategoria.set(String(g.categoria_id), c);
  }
  const principal = porMoneda.has("COP") || porMoneda.size === 0 ? "COP" : [...porMoneda.keys()][0];
  const barras = [...porCategoria.entries()]
    .map(([k, c]) => ({ clave: k, nombre: c.nombre, valor: c.montos.get(principal) ?? 0,
      texto: [...c.montos.entries()].map(([m, v]) => formatearMonto(v, m)).join(" · ") }))
    .sort((a, b) => b.valor - a.valor);
  const filtros = { p: clave === "mes" ? "" : clave, desde: clave === "rango" ? actual.desde : "", hasta: clave === "rango" ? actual.hasta : "",
    categoria: categoriaId ? String(categoriaId) : "", concepto: conceptoId ? String(conceptoId) : "" };

  return (
    <>
      <EncabezadoPagina icono={Receipt} titulo="Gastos" descripcion={`Lo que se compra y se paga en el momento · ${formatearFecha(actual.desde)} al ${formatearFecha(actual.hasta)}`}
        acciones={puede(perfil.rol, "gastos_registrar") ? <BotonNuevoGasto catalogo={catalogo} hoy={hoy} /> : undefined} />
      <FiltrosDashboard periodo={clave} desde={actual.desde} hasta={actual.hasta} moneda="" monedas={[]} conMoneda={false}
        extras={{ categoria: filtros.categoria, concepto: filtros.concepto }} />
      <FiltrosUrl valores={filtros} campos={[
        { nombre: "categoria", tipo: "select", etiqueta: "Categoría", opciones: [["", "Todas las categorías"], ...catalogo.categorias.map((c): [string, string] => [String(c.id), c.nombre])] },
        { nombre: "concepto", tipo: "select", etiqueta: "Concepto", opciones: [["", "Todos los conceptos"],
          ...catalogo.conceptos.filter((c) => !categoriaId || c.categoria_id === categoriaId).map((c): [string, string] => [String(c.id), c.nombre])] },
      ]} />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["COP", "USD"] as const).map((m) => (
          <TarjetaKpi key={m} titulo={`Gastado ${m}`} icono={Receipt} valor={formatearMonto(porMoneda.get(m) ?? 0, m)} />
        ))}
        <TarjetaKpi titulo="Gastos registrados" icono={Tags} valor={filas.length} detalle="en el periodo" />
        <TarjetaKpi titulo="Mayor categoría" icono={Tags} valor={barras[0]?.nombre ?? "—"} detalle={barras[0]?.texto} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ListaGastos filas={filas} catalogo={catalogo} hoy={hoy} puedeCorregir={puede(perfil.rol, "gastos_corregir")} />
        <Tarjeta titulo="Por categoría">
          <Barras filas={barras} vacio="Sin gastos en el periodo." />
        </Tarjeta>
      </div>
    </>
  );
}
