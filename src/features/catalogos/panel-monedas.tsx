"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { ConfirmarAccion } from "@/components/comunes/confirmar-accion";
import { formatearFecha } from "@/lib/fechas";
import { formatearNumero } from "@/lib/dinero";
import { eliminarDeCatalogo, guardarMoneda, guardarTasa } from "./acciones";
import { DialogoFormulario } from "./dialogo-formulario";
import { esquemaMoneda, esquemaTasa } from "./esquemas";
import { EtiquetaEstado, ListaCatalogo } from "./lista-catalogo";
import { useFormularioCatalogo } from "./use-formulario";

export type Moneda = { codigo: string; nombre: string; simbolo: string; decimales: number; activa: boolean; orden: number };
export type Tasa = { id: number; fecha: string; moneda_origen: string; moneda_destino: string; tasa: number; nota: string | null };

export function PanelMonedas({ monedas, tasas, hoy }: { monedas: Moneda[]; tasas: Tasa[]; hoy: string }) {
  const [editando, setEditando] = useState<Moneda | "nuevo" | null>(null);
  const [nuevaTasa, setNuevaTasa] = useState(false);
  return (
    <div className="space-y-6">
      <ListaCatalogo
        tabla="monedas" filas={monedas} clave={(m) => m.codigo} nombre={(m) => m.nombre}
        textoBusqueda={(m) => `${m.codigo} ${m.nombre}`} activo={(m) => m.activa}
        textoNuevo="Nueva moneda" vacio="No hay monedas" onNuevo={() => setEditando("nuevo")} onEditar={setEditando}
        columnas={[
          { titulo: "Código", className: "w-24", celda: (m) => <span className="font-mono font-bold">{m.codigo}</span> },
          { titulo: "Nombre", celda: (m) => m.nombre },
          { titulo: "Ejemplo", celda: (m) => <span className="tabular">{m.codigo} {m.simbolo} {formatearNumero(1250, m.decimales)}</span> },
          { titulo: "Estado", celda: (m) => <EtiquetaEstado activo={m.activa} /> },
        ]}
        tarjeta={(m) => <p><span className="font-mono font-bold">{m.codigo}</span> · {m.nombre} <span className="tabular text-muted-foreground">({m.simbolo} {formatearNumero(1250, m.decimales)})</span></p>}
      />
      {editando && <FormMoneda moneda={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} />}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Tasas de cambio</h2>
            <p className="text-sm text-muted-foreground">Solo informativas, para reportes consolidados. Los saldos nunca se convierten solos.</p>
          </div>
          <Button variant="outline" onClick={() => setNuevaTasa(true)}><Plus className="size-4" /> Registrar tasa</Button>
        </div>
        {tasas.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún no hay tasas registradas.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {tasas.map((t) => <FilaTasa key={t.id} tasa={t} />)}
          </ul>
        )}
      </section>
      {nuevaTasa && <FormTasa monedas={monedas.filter((m) => m.activa)} hoy={hoy} onCerrar={() => setNuevaTasa(false)} />}
    </div>
  );
}

function FilaTasa({ tasa }: { tasa: Tasa }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{formatearFecha(tasa.fecha)}</span>
      <span className="tabular flex flex-1 flex-wrap items-center gap-1.5">
        1 <b>{tasa.moneda_origen}</b> <ArrowRight className="size-3.5 text-muted-foreground" /> {formatearNumero(tasa.tasa, 4).replace(/,?0+$/, "")} <b>{tasa.moneda_destino}</b>
        {tasa.nota && <span className="text-xs text-muted-foreground">· {tasa.nota}</span>}
      </span>
      <ConfirmarAccion titulo="¿Eliminar esta tasa?" textoConfirmar="Eliminar" destructivo
        alConfirmar={() => iniciar(async () => {
          const r = await eliminarDeCatalogo("tasas_cambio", tasa.id);
          if (r.ok) { toast.success(r.mensaje); router.refresh(); } else toast.error(r.error);
        })}
        disparador={<Button variant="ghost" size="icon" aria-label="Eliminar tasa"><Trash2 className="size-4" /></Button>} />
    </li>
  );
}

function FormMoneda({ moneda, onCerrar }: { moneda: Moneda | null; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormularioCatalogo(
    esquemaMoneda,
    moneda ? { ...moneda, nuevo: false } : { nuevo: true, codigo: "", nombre: "", simbolo: "$", decimales: 2, activa: true, orden: 9 },
    guardarMoneda, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={moneda ? `Editar ${moneda.codigo}` : "Nueva moneda"} descripcion="Para usar bolívares (VES), actívala aquí.">
      <CampoTexto etiqueta="Código" requerido disabled={!!moneda} placeholder="EUR" error={err.codigo?.message} {...form.register("codigo")} />
      <CampoTexto etiqueta="Nombre" requerido error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Símbolo" requerido error={err.simbolo?.message} {...form.register("simbolo")} />
      <CampoTexto etiqueta="Decimales" inputMode="numeric" ayuda="COP usa 0; USD y VES usan 2." error={err.decimales?.message} {...form.register("decimales")} />
      <CampoTexto etiqueta="Orden" inputMode="numeric" {...form.register("orden")} />
      <Controller control={form.control} name="activa" render={({ field }) => (
        <label className="flex items-center justify-between gap-3 self-end rounded-xl border px-3 py-2 text-sm">
          Activa <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
        </label>
      )} />
    </DialogoFormulario>
  );
}

function FormTasa({ monedas, hoy, onCerrar }: { monedas: Moneda[]; hoy: string; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormularioCatalogo(
    esquemaTasa,
    { fecha: hoy, moneda_origen: "USD", moneda_destino: "COP", tasa: "", nota: "" },
    guardarTasa, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar} titulo="Registrar tasa de cambio"
      descripcion="Si ya existe una tasa para ese día y par de monedas, se reemplaza.">
      <CampoTexto etiqueta="Fecha" type="date" className="sm:col-span-2" error={err.fecha?.message} {...form.register("fecha")} />
      <CampoSelect etiqueta="1 unidad de" {...form.register("moneda_origen")}>
        {monedas.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Equivale en" error={err.moneda_destino?.message} {...form.register("moneda_destino")}>
        {monedas.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Tasa" requerido inputMode="decimal" placeholder="4.000" className="sm:col-span-2" error={err.tasa?.message} {...form.register("tasa")} />
      <CampoTexto etiqueta="Nota" className="sm:col-span-2" placeholder="Ej. tasa del día en el mercado" {...form.register("nota")} />
    </DialogoFormulario>
  );
}
