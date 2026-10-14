"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatearCantidad, formatearMonto, formatearNumero } from "@/lib/dinero";
import { cn } from "@/lib/utils";

export type Semana = { semana: string; unidades: number; kg: number; total: number };
type Vista = "unidades" | "total";

const corto = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : String(Math.round(v)));
const ddmm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const finSemana = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };
const cambio = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);

/**
 * Rendimiento semanal: lo vendido cada semana. Si una semana vende más que la anterior la línea sube
 * (punto verde ▲); si vende menos, baja (punto rojo ▼).
 */
export function GraficoRendimiento({ semanas, moneda }: { semanas: Semana[]; moneda: string }) {
  const [vista, setVista] = useState<Vista>("unidades");
  const datos = semanas.map((s, i) => {
    const v = s[vista];
    const prev = i > 0 ? semanas[i - 1][vista] : null;
    return { ...s, valor: v, sube: prev === null ? null : v > prev ? true : v < prev ? false : null, pct: prev === null ? null : cambio(v, prev) };
  });
  const ultima = datos[datos.length - 1];
  const fmt = (v: number) => (vista === "unidades" ? `${formatearCantidad(v, 0)} bolsas` : formatearMonto(v, moneda));
  const hay = datos.some((d) => d.valor > 0);

  return (
    <section className="rounded-2xl border bg-card p-4" aria-label="Rendimiento semanal">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Rendimiento semanal</h2>
          {ultima && (
            <p className="text-sm text-muted-foreground">
              Esta semana <b className="tabular text-foreground">{fmt(ultima.valor)}</b>{" "}
              {ultima.pct === null ? <span>(la semana anterior no tuvo ventas)</span> : (
                <span className={cn("inline-flex items-center font-medium", ultima.sube === true && "text-success", ultima.sube === false && "text-destructive")}>
                  {ultima.sube === true ? <ArrowUpRight className="size-4" /> : ultima.sube === false ? <ArrowDownRight className="size-4" /> : <Minus className="size-4" />}
                  {ultima.pct >= 0 ? "+" : "−"}{formatearNumero(Math.abs(ultima.pct), 0)} % que la semana anterior
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex rounded-lg border p-0.5 text-xs" role="radiogroup" aria-label="Medir en">
          {([["unidades", "Bolsas"], ["total", `Monto ${moneda}`]] as const).map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={vista === v} onClick={() => setVista(v)}
              className={cn("rounded-md px-3 py-1", vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{t}</button>
          ))}
        </div>
      </div>
      {!hay ? <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">Todavía no hay ventas en estas semanas.</p> : (
        <div className="h-52" role="img" aria-label={`Ventas de las últimas ${datos.length} semanas: ${datos.map((d) => `${ddmm(d.semana)} ${fmt(d.valor)}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
              <XAxis dataKey="semana" tickFormatter={ddmm} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis tickFormatter={corto} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const d = active ? (payload?.[0]?.payload as (typeof datos)[number] | undefined) : undefined;
                  if (!d) return null;
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                      <p className="tabular text-sm font-semibold">{fmt(d.valor)}</p>
                      <p className="text-muted-foreground">Semana {ddmm(d.semana)} – {ddmm(finSemana(d.semana))}</p>
                      {d.pct !== null && (
                        <p className={cn("font-medium", d.sube === true && "text-success", d.sube === false && "text-destructive")}>
                          {d.sube === true ? "▲" : d.sube === false ? "▼" : "="} {d.pct >= 0 ? "+" : "−"}{formatearNumero(Math.abs(d.pct), 0)} % vs. la anterior
                        </p>
                      )}
                    </div>
                  );
                }} />
              <Line type="linear" dataKey="valor" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" isAnimationActive={false}
                dot={({ cx, cy, payload, index }) => (
                  <circle key={index} cx={cx} cy={cy} r={4.5} stroke="var(--card)" strokeWidth={2}
                    fill={payload.sube === true ? "var(--success)" : payload.sube === false ? "var(--destructive)" : "var(--viz-1)"} />
                )}
                activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2, fill: "var(--viz-1)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground"><span className="text-success">●</span> vendió más que la semana anterior · <span className="text-destructive">●</span> vendió menos</p>
    </section>
  );
}
