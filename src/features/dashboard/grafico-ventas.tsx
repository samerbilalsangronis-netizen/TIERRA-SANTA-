"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatearMonto } from "@/lib/dinero";

type Punto = { fecha: string; total: number; facturas: number };
const corto = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : String(Math.round(v)));
const dia = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

/** Ventas por día en una moneda (una sola serie: el título dice qué es). */
export function GraficoVentas({ puntos, moneda }: { puntos: Punto[]; moneda: string }) {
  const hay = puntos.some((p) => p.total > 0);
  if (!hay) return <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Sin ventas en {moneda} en este periodo.</p>;
  return (
    <div className="h-56" role="img" aria-label={`Ventas por día en ${moneda}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="fecha" tickFormatter={dia} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={corto} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as Punto | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                  <p className="tabular text-sm font-semibold">{formatearMonto(p.total, moneda)}</p>
                  <p className="text-muted-foreground">{dia(p.fecha)} · {p.facturas} factura{p.facturas === 1 ? "" : "s"}</p>
                </div>
              );
            }} />
          <Area type="monotone" dataKey="total" stroke="var(--viz-1)" strokeWidth={2} fill="var(--viz-1)" fillOpacity={0.1}
            dot={false} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--viz-1)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
