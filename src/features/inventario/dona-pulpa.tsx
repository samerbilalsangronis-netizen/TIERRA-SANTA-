"use client";
import { useState } from "react";
import Link from "next/link";
import { formatearCantidad, formatearNumero } from "@/lib/dinero";
import { cn } from "@/lib/utils";

export type SegmentoPulpa = { fruta_id: number; codigo: number; nombre: string; emoji: string | null; kg: number };

// Colores categóricos validados (claro / oscuro). El color sigue a la fruta (orden fijo por código), no al tamaño.
const COLORES = 8;
const MAX_SEGMENTOS = 6; // más rubros se agrupan en "Otros"

/**
 * Dona con el porcentaje de pulpa de cada rubro (kg de pulpa: bolsas × peso).
 * Pasar el ratón o tocar un segmento muestra ese rubro en el centro.
 */
export function DonaPulpa({ segmentos, ordenFrutas, modo, hrefInventario, hrefSemana }: {
  segmentos: SegmentoPulpa[];
  /** Ids de todas las frutas en orden fijo (asigna el color de cada una). */
  ordenFrutas: number[];
  modo: "inventario" | "semana";
  hrefInventario: string; hrefSemana: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const total = segmentos.reduce((a, s) => a + s.kg, 0);

  // Los más grandes primero; el resto se agrupa en "Otros"
  const ordenados = [...segmentos].sort((a, b) => b.kg - a.kg);
  const visibles = ordenados.length > MAX_SEGMENTOS ? ordenados.slice(0, MAX_SEGMENTOS - 1) : ordenados;
  const resto = ordenados.slice(visibles.length);
  const partes = [
    ...visibles.map((s) => ({ clave: s.fruta_id, nombre: s.nombre, emoji: s.emoji, kg: s.kg, color: colorDe(s.fruta_id, ordenFrutas) })),
    ...(resto.length ? [{ clave: -1, nombre: `Otros (${resto.length})`, emoji: null, kg: resto.reduce((a, s) => a + s.kg, 0), color: "var(--viz-otros)" }] : []),
  ];

  // Geometría: anillo de radio 80, grosor 26, con 2px de separación entre segmentos
  const R = 80, GROSOR = 26, C = 2 * Math.PI * R, ESPACIO = partes.length > 1 ? 2 : 0;
  let acumulado = 0;
  const arcos = partes.map((p) => {
    const largo = total > 0 ? (p.kg / total) * C : 0;
    const arco = { ...p, largo: Math.max(largo - ESPACIO, 0.01), inicio: acumulado };
    acumulado += largo;
    return arco;
  });
  const enfoque = arcos.find((a) => a.clave === activo) ?? null;
  const pct = (kg: number) => (total > 0 ? (kg * 100) / total : 0);

  return (
    <section className="viz-pulpa mb-4 rounded-2xl border bg-card p-4" aria-labelledby="titulo-pulpa">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-pulpa" className="font-semibold">Porcentaje de pulpa por rubro</h2>
        <div className="flex rounded-lg border p-0.5 text-xs" role="tablist" aria-label="Qué pulpa se muestra">
          <Link href={hrefInventario} scroll={false} role="tab" aria-selected={modo === "inventario"}
            className={cn("rounded-md px-3 py-1", modo === "inventario" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>En inventario</Link>
          <Link href={hrefSemana} scroll={false} role="tab" aria-selected={modo === "semana"}
            className={cn("rounded-md px-3 py-1", modo === "semana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Producido esta semana</Link>
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <svg viewBox="0 0 200 200" className="size-48 shrink-0" role="img"
          aria-label={total > 0 ? partes.map((p) => `${p.nombre} ${formatearNumero(pct(p.kg), 0)} %`).join(", ") : "Sin pulpa"}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--viz-pista)" strokeWidth={GROSOR} />
          {total > 0 && arcos.map((a) => (
            <circle key={a.clave} cx="100" cy="100" r={R} fill="none" stroke={a.color} strokeWidth={activo === a.clave ? GROSOR + 6 : GROSOR}
              strokeDasharray={`${a.largo} ${C - a.largo}`} strokeDashoffset={-a.inicio} transform="rotate(-90 100 100)"
              className="cursor-pointer transition-[stroke-width,opacity] duration-150" opacity={activo === null || activo === a.clave ? 1 : 0.35}
              onMouseEnter={() => setActivo(a.clave)} onMouseLeave={() => setActivo(null)}
              onClick={() => setActivo((x) => (x === a.clave ? null : a.clave))}>
              <title>{`${a.nombre}: ${formatearCantidad(a.kg, 1)} kg (${formatearNumero(pct(a.kg), 1)} %)`}</title>
            </circle>
          ))}
          <text x="100" y={total > 0 ? 96 : 96} textAnchor="middle" className="fill-foreground text-[26px] font-bold tabular-nums">
            {total > 0 ? `${formatearNumero(enfoque ? pct(enfoque.kg) : 100, 0)} %` : "—"}
          </text>
          <text x="100" y="118" textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {total === 0 ? (modo === "semana" ? "Sin producción esta semana" : "Sin pulpa en inventario")
              : enfoque ? truncar(enfoque.nombre, 18) : `${formatearCantidad(total, 0)} kg en total`}
          </text>
        </svg>

        {total > 0 && (
          <ul className="grid w-full flex-1 gap-1 text-sm">
            {arcos.map((a) => (
              <li key={a.clave}>
                <button type="button" onMouseEnter={() => setActivo(a.clave)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(a.clave)} onBlur={() => setActivo(null)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", activo === a.clave && "bg-muted")}>
                  <span className="size-3 shrink-0 rounded-sm" style={{ background: a.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{a.emoji ? `${a.emoji} ` : ""}{a.nombre}</span>
                  <span className="tabular text-xs text-muted-foreground">{formatearCantidad(a.kg, 1)} kg</span>
                  <span className="tabular w-12 text-right font-semibold">{formatearNumero(pct(a.kg), 0)} %</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function colorDe(frutaId: number, orden: number[]) {
  const i = orden.indexOf(frutaId);
  return i >= 0 && i < COLORES ? `var(--viz-${i + 1})` : "var(--viz-otros)";
}

const truncar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
