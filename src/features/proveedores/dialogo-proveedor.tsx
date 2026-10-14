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
import { guardarProveedor } from "./acciones";
import { esquemaProveedor } from "./esquemas";

export type ProveedorEditable = {
  id: number; nombre: string; documento: string | null; telefono: string | null; ubicacion: string | null;
  moneda_habitual: string; notas: string | null; activo: boolean;
};

export function BotonNuevoProveedor({ monedas }: { monedas: string[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button onClick={() => setAbierto(true)}><Plus className="size-4" /> Nuevo proveedor</Button>
      {abierto && <DialogoProveedor monedas={monedas} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

export function DialogoProveedor({ proveedor, monedas, onCerrar }: { proveedor?: ProveedorEditable; monedas: string[]; onCerrar: () => void }) {
  const router = useRouter();
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaProveedor,
    proveedor
      ? { ...proveedor, documento: proveedor.documento ?? "", telefono: proveedor.telefono ?? "", ubicacion: proveedor.ubicacion ?? "", notas: proveedor.notas ?? "" }
      : { nombre: "", documento: "", telefono: "", ubicacion: "", moneda_habitual: "COP", notas: "", activo: true },
    async (d) => {
      const r = await guardarProveedor(d);
      if (r.ok && !proveedor) {
        toast.success(r.mensaje);
        router.push(`/proveedores/${r.datos.id}`);
        return { ok: true, datos: undefined };
      }
      return r.ok ? { ok: true, datos: undefined, mensaje: r.mensaje } : r;
    },
    onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={proveedor ? `Editar ${proveedor.nombre}` : "Nuevo proveedor"}>
      <CampoTexto etiqueta="Nombre" requerido className="sm:col-span-2" error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Cédula / RIF / NIT" {...form.register("documento")} />
      <CampoTexto etiqueta="Teléfono" type="tel" inputMode="tel" {...form.register("telefono")} />
      <CampoTexto etiqueta="Ubicación / finca" {...form.register("ubicacion")} />
      <CampoSelect etiqueta="Moneda habitual" {...form.register("moneda_habitual")}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </CampoSelect>
      <CampoArea etiqueta="Notas" rows={2} className="sm:col-span-2" {...form.register("notas")} />
      {proveedor && (
        <Controller control={form.control} name="activo" render={({ field }) => (
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm sm:col-span-2">
            Activo <Switch checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          </label>
        )} />
      )}
    </DialogoFormulario>
  );
}
