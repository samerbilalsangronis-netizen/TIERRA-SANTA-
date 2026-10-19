"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatearMonto } from "@/lib/dinero";
import { cn } from "@/lib/utils";
import type { EmpleadoLista, Tarea } from "./datos";
import { GRUPOS_PERSONAL, type TipoEmpleado } from "./tipos";

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Columna izquierda: Personal fijo, Por destajo (con su saldo) y Tareas (precios por unidad). */
export function ListaEmpleados({ empleados, tareas, seleccionado }: { empleados: EmpleadoLista[]; tareas: Tarea[]; seleccionado?: number }) {
  // Se abre en el grupo del empleado que se está viendo
  const tipoSel = empleados.find((e) => e.id === seleccionado)?.tipo;
  const [pestana, setPestana] = useState<TipoEmpleado | "tareas">(tipoSel === "destajo" ? "destajo" : "fijo");
  const [q, setQ] = useState("");
  const [inactivos, setInactivos] = useState(false);
  const filas = useMemo(() => {
    const t = normalizar(q.trim());
    return empleados.filter((e) => (pestana === "fijo" ? e.tipo === "fijo" : e.tipo !== "fijo")
      && (inactivos || e.activo || e.id === seleccionado) && (!t || normalizar(`${e.nombre} ${e.cedula ?? ""} ${e.cargo ?? ""}`).includes(t)));
  }, [empleados, q, inactivos, seleccionado, pestana]);
  const activos = (tipo: TipoEmpleado) => empleados.filter((e) => e.activo && (tipo === "fijo" ? e.tipo === "fijo" : e.tipo !== "fijo")).length;
  const debe = filas.reduce((a, e) => a + Math.max(e.saldo_neto, 0), 0);

  return (
    <aside className="rounded-2xl border bg-card p-2">
      <div className="mb-2 flex gap-1 rounded-xl bg-muted/50 p-1" role="tablist">
        {[...GRUPOS_PERSONAL.map((g) => ({ p: g.tipo, texto: `${g.corto} (${activos(g.tipo)})` })), { p: "tareas" as const, texto: `Tareas (${tareas.filter((t) => t.activa).length})` }].map(({ p, texto }) => (
          <button key={p} type="button" role="tab" aria-selected={pestana === p} onClick={() => setPestana(p)}
            className={cn("flex-1 rounded-lg py-1.5 text-sm", pestana === p ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {texto}
          </button>
        ))}
      </div>

      {pestana !== "tareas" ? (
        <>
          <p className="mb-2 flex items-baseline justify-between px-1 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">{GRUPOS_PERSONAL.find((g) => g.tipo === pestana)?.titulo}</span>
            {debe > 0 && <span>Se les debe <b className="tabular text-warning">{formatearMonto(debe, "COP", { sinCodigo: true })}</b></span>}
          </p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empleado…" className="pl-8" aria-label="Buscar empleado" />
          </div>
          <ul className="space-y-1">
            {filas.map((e) => (
              <li key={e.id}>
                <Link href={`/nomina/${e.id}`} aria-current={e.id === seleccionado ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors", e.id === seleccionado ? "bg-primary/15" : "hover:bg-muted", !e.activo && "opacity-60")}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary">
                    {e.nombre.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.nombre}</span>
                    {e.cargo && <span className="block text-xs text-muted-foreground">{e.cargo}</span>}
                  </span>
                  {e.saldo_neto !== 0 && (
                    <span className={cn("tabular text-xs font-semibold", e.saldo_neto > 0 ? "text-warning" : "text-muted-foreground")}>
                      {formatearMonto(e.saldo_neto, "COP", { sinCodigo: true })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {filas.length === 0 && <li className="px-2 py-4 text-center text-sm text-muted-foreground">{pestana === "fijo" ? "Sin personal fijo." : "Sin personal por destajo."}</li>}
          </ul>
          <label className="mt-2 flex items-center justify-end gap-2 px-2 text-xs text-muted-foreground">
            <Switch checked={inactivos} onCheckedChange={(v) => setInactivos(Boolean(v))} /> Ver inactivos
          </label>
        </>
      ) : (
        <>
          <ul className="divide-y">
            {tareas.filter((t) => t.activa).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-2 py-2 text-sm">
                <span className="min-w-0 truncate">{t.emoji} {t.nombre}</span>
                <span className="tabular shrink-0 font-semibold text-warning">{formatearMonto(t.valor, "COP", { sinCodigo: true })}<span className="text-xs font-normal text-muted-foreground"> /{t.unidad}</span></span>
              </li>
            ))}
          </ul>
          <Link href="/configuracion/catalogos/tareas" className="mt-2 block px-2 text-xs text-primary hover:underline">Cambiar precios o agregar tareas →</Link>
        </>
      )}
    </aside>
  );
}
