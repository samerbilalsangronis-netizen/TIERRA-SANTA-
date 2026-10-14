"use client";
import { useRef, useState } from "react";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { guardarEmpaque, guardarFacturaExterna } from "./acciones";
import { esquemaEmpaque, esquemaFacturaExterna } from "./esquemas";

export type FacturaExternaEditable = {
  id: number; numero_externo: string | null; fecha: string; moneda: string; total: number; observaciones: string | null;
  soporte_url: string | null; soporte_path: string | null; pagado: number;
};
export type EmpaqueEditable = { id: number; fecha: string; retiradas: number; devueltas: number; nota: string | null };

/** Sube el soporte (PDF o foto) de una factura al bucket privado "facturas". */
function SubirSoporte({ clienteId, ruta, onCambio }: { clienteId: number; ruta: string | null; onCambio: (ruta: string | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [nombre, setNombre] = useState<string | null>(ruta ? ruta.split("/").pop() ?? ruta : null);
  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (archivo.size > 10 * 1024 * 1024) { toast.error("El archivo supera 10 MB."); return; }
    setSubiendo(true);
    try {
      const ext = (archivo.name.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
      const destino = `clientes/${clienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await crearClienteNavegador().storage.from("facturas").upload(destino, archivo, { contentType: archivo.type, upsert: false });
      if (error) throw error;
      setNombre(archivo.name);
      onCambio(destino);
      toast.success("Soporte adjuntado.");
    } catch (err) {
      toast.error(`No se pudo subir: ${err instanceof Error ? err.message : "error"}`);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>Soporte (PDF o foto)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={entrada} type="file" accept="application/pdf,image/*" className="hidden" onChange={elegir} />
        <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => entrada.current?.click()}>
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} {nombre ? "Cambiar archivo" : "Adjuntar archivo"}
        </Button>
        {nombre && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="size-3" /> {nombre}
            <button type="button" aria-label="Quitar archivo" onClick={() => { setNombre(null); onCambio(null); }}><X className="size-3" /></button>
          </span>
        )}
      </div>
    </div>
  );
}

export function DialogoFacturaExterna({ clienteId, monedas, hoy, factura, onCerrar }: {
  clienteId: number; monedas: string[]; hoy: string; factura?: FacturaExternaEditable; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaFacturaExterna,
    factura
      ? { id: factura.id, cliente_id: clienteId, numero_externo: factura.numero_externo ?? "", fecha: factura.fecha, moneda: factura.moneda,
          total: factura.total, observaciones: factura.observaciones ?? "", soporte_url: factura.soporte_url ?? "", soporte_path: factura.soporte_path ?? "" }
      : { cliente_id: clienteId, numero_externo: "", fecha: hoy, moneda: "USD", total: "", observaciones: "", soporte_url: "", soporte_path: "" },
    guardarFacturaExterna, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={factura ? "Editar factura histórica" : "Factura externa / histórica"}
      descripcion="Para facturas hechas fuera del sistema (programa anterior, hojas de cálculo). No mueve inventario.">
      <CampoTexto etiqueta="Nº de factura" requerido error={err.numero_externo?.message} {...form.register("numero_externo")} />
      <CampoTexto etiqueta="Fecha" type="date" error={err.fecha?.message} {...form.register("fecha")} />
      <CampoSelect etiqueta="Moneda" disabled={Boolean(factura && factura.pagado > 0)}
        ayuda={factura && factura.pagado > 0 ? "Tiene pagos: no se cambia la moneda." : undefined} {...form.register("moneda")}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Monto total" requerido inputMode="decimal" error={err.total?.message} {...form.register("total")} />
      <CampoTexto etiqueta="Observaciones" className="sm:col-span-2" {...form.register("observaciones")} />
      <CampoTexto etiqueta="URL del soporte (opcional)" className="sm:col-span-2" placeholder="https://drive.google.com/…" error={err.soporte_url?.message} {...form.register("soporte_url")} />
      <SubirSoporte clienteId={clienteId} ruta={factura?.soporte_path ?? null} onCambio={(r) => form.setValue("soporte_path", r ?? "")} />
    </DialogoFormulario>
  );
}

export function DialogoEmpaque({ clienteId, hoy, registro, onCerrar }: {
  clienteId: number; hoy: string; registro?: EmpaqueEditable; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaEmpaque,
    registro
      ? { ...registro, cliente_id: clienteId, retiradas: registro.retiradas || "", devueltas: registro.devueltas || "", nota: registro.nota ?? "" }
      : { cliente_id: clienteId, fecha: hoy, retiradas: "", devueltas: "", nota: "" },
    guardarEmpaque, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={registro ? "Editar movimiento de cajas" : "Cajas / empaques"} descripcion="Cajas que se llevó el cliente y las que devolvió.">
      <CampoTexto etiqueta="Fecha" type="date" className="sm:col-span-2" error={err.fecha?.message} {...form.register("fecha")} />
      <CampoTexto etiqueta="Retiradas" inputMode="numeric" error={err.retiradas?.message} {...form.register("retiradas")} />
      <CampoTexto etiqueta="Devueltas" inputMode="numeric" error={err.devueltas?.message} {...form.register("devueltas")} />
      <CampoTexto etiqueta="Nota" className="sm:col-span-2" {...form.register("nota")} />
    </DialogoFormulario>
  );
}
