"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { guardarCliente } from "./acciones";
import { esquemaCliente } from "./esquemas";

export type ClienteEditable = {
  id: number; numero: number; nombre: string; documento: string | null; telefono: string | null; direccion: string | null;
  correo: string | null; notas: string | null; limite_credito: number | null; limite_moneda: string | null; activo: boolean;
};

export function BotonNuevoCliente({ esAdmin }: { esAdmin: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button onClick={() => setAbierto(true)}><Plus className="size-4" /> Nuevo cliente</Button>
      {abierto && <DialogoCliente esAdmin={esAdmin} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

/**
 * Formulario de cliente. `alCrear` permite usarlo desde otra pantalla (p. ej. la factura)
 * sin navegar: recibe el id del cliente creado.
 */
export function DialogoCliente({ cliente, esAdmin, onCerrar, alCrear }: {
  cliente?: ClienteEditable; esAdmin: boolean; onCerrar: () => void; alCrear?: (id: number) => void;
}) {
  const router = useRouter();
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaCliente,
    cliente
      ? {
          ...cliente, documento: cliente.documento ?? "", telefono: cliente.telefono ?? "", direccion: cliente.direccion ?? "",
          correo: cliente.correo ?? "", notas: cliente.notas ?? "", limite_credito: cliente.limite_credito ?? "", limite_moneda: cliente.limite_moneda ?? "",
        }
      : { numero: "", nombre: "", documento: "", telefono: "", direccion: "", correo: "", notas: "", limite_credito: "", limite_moneda: "", activo: true },
    async (d) => {
      const r = await guardarCliente(d);
      if (!r.ok) return r;
      if (!cliente) {
        toast.success(r.mensaje);
        if (alCrear) alCrear(r.datos.id); else router.push(`/clientes/${r.datos.id}`);
        return { ok: true, datos: undefined };
      }
      return { ok: true, datos: undefined, mensaje: r.mensaje };
    },
    onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={cliente ? `Editar cliente nº ${cliente.numero}` : "Nuevo cliente"}>
      {(esAdmin || !cliente) && (
        <CampoTexto etiqueta="Nº de cliente" inputMode="numeric" disabled={!esAdmin} placeholder="Automático"
          ayuda={esAdmin ? "Vacío = el siguiente consecutivo." : "Lo asigna el sistema."} error={err.numero?.message} {...form.register("numero")} />
      )}
      <CampoTexto etiqueta="Nombre o razón social" requerido className={esAdmin || !cliente ? "" : "sm:col-span-2"} error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Cédula / RIF / NIT" {...form.register("documento")} />
      <CampoTexto etiqueta="Teléfono" type="tel" inputMode="tel" {...form.register("telefono")} />
      <CampoTexto etiqueta="Dirección" className="sm:col-span-2" {...form.register("direccion")} />
      <CampoTexto etiqueta="Correo" type="email" inputMode="email" autoCapitalize="none" error={err.correo?.message} {...form.register("correo")} />
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <CampoTexto etiqueta="Límite de crédito" inputMode="decimal" error={err.limite_credito?.message} {...form.register("limite_credito")} />
        <CampoSelect etiqueta="Moneda" {...form.register("limite_moneda")}>
          <option value="">—</option><option value="USD">USD</option><option value="COP">COP</option><option value="VES">VES</option>
        </CampoSelect>
      </div>
      <CampoArea etiqueta="Notas" rows={2} className="sm:col-span-2" {...form.register("notas")} />
      {cliente && (
        <Controller control={form.control} name="activo" render={({ field }) => (
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm sm:col-span-2">
            Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          </label>
        )} />
      )}
    </DialogoFormulario>
  );
}
