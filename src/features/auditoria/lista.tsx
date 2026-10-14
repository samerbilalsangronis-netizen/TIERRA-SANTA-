"use client";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatearFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { Json } from "@/lib/supabase/database.types";

type Fila = {
  id: number; ocurrido_el: string; usuario: string | null; accion: string; tabla: string;
  registro_id: string | null; antes: Json | null; despues: Json | null; nota: string | null;
};

const COLOR_ACCION: Record<string, string> = {
  CREAR: "bg-success/15 text-success border-success/30",
  EMITIR: "bg-success/15 text-success border-success/30",
  EDITAR: "bg-primary/15 text-primary border-primary/30",
  BORRAR: "bg-destructive/15 text-destructive border-destructive/30",
  ANULAR: "bg-destructive/15 text-destructive border-destructive/30",
  LOGIN_RECHAZADO: "bg-warning/15 text-warning border-warning/30",
};

function valorTexto(v: Json | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Diferencias({ antes, despues }: { antes: Json | null; despues: Json | null }) {
  const a = (antes && typeof antes === "object" && !Array.isArray(antes) ? antes : {}) as Record<string, Json>;
  const d = (despues && typeof despues === "object" && !Array.isArray(despues) ? despues : {}) as Record<string, Json>;
  const claves = Array.from(new Set([...Object.keys(a), ...Object.keys(d)])).filter((k) => !["search", "updated_at", "created_at"].includes(k));
  if (claves.length === 0) return <p className="text-xs text-muted-foreground">Sin detalle.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Campo</th><th className="py-1 pr-3">Antes</th><th className="py-1">Después</th></tr></thead>
        <tbody>
          {claves.map((k) => (
            <tr key={k} className="border-t border-border/50 align-top">
              <td className="py-1 pr-3 font-medium">{k}</td>
              <td className="max-w-[320px] break-words py-1 pr-3 text-destructive/90">{k in a ? valorTexto(a[k]) : ""}</td>
              <td className="max-w-[320px] break-words py-1 text-success">{k in d ? valorTexto(d[k]) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListaAuditoria({ filas }: { filas: Fila[] }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <ul className="divide-y">
        {filas.map((f) => {
          const expandida = abierta === f.id;
          return (
            <Fragment key={f.id}>
              <li>
                <button type="button" onClick={() => setAbierta(expandida ? null : f.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/40" aria-expanded={expandida}>
                  {expandida ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">{formatearFechaHora(f.ocurrido_el)}</span>
                  <Badge variant="outline" className={cn("shrink-0", COLOR_ACCION[f.accion])}>{f.accion}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{f.tabla}</span>
                    {f.registro_id && <span className="text-muted-foreground"> #{f.registro_id}</span>}
                    {f.nota && <span className="text-muted-foreground"> · {f.nota}</span>}
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{f.usuario ?? "sistema"}</span>
                </button>
              </li>
              {expandida && (
                <li className="bg-muted/20 px-4 py-3">
                  <p className="mb-2 text-xs text-muted-foreground sm:hidden">Usuario: {f.usuario ?? "sistema"}</p>
                  <Diferencias antes={f.antes} despues={f.despues} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
