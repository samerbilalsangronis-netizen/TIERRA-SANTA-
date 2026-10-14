"use client";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { formatearMonto } from "@/lib/dinero";
import { guardarAbono, guardarCestas } from "./acciones";
import { esquemaAbono, esquemaCestas } from "./esquemas";

export type AbonoEditable = {
  id: number; fecha: string; moneda: string; monto: number; metodo_id: number | null;
  referencia: string | null; pagado_por: string | null; nota: string | null;
};
export type CestasEditable = { id: number; fecha: string; entregadas: number; devueltas: number; nota: string | null };

export function DialogoAbono({
  proveedorId, monedas, metodos, monedaPorDefecto, saldos, hoy, abono, onCerrar,
}: {
  proveedorId: number; monedas: string[]; metodos: { id: number; nombre: string }[]; monedaPorDefecto: string;
  saldos: Record<string, number>; hoy: string; abono?: AbonoEditable; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaAbono,
    abono
      ? { ...abono, proveedor_id: proveedorId, metodo_id: abono.metodo_id ?? "", referencia: abono.referencia ?? "", pagado_por: abono.pagado_por ?? "", nota: abono.nota ?? "" }
      : { proveedor_id: proveedorId, fecha: hoy, moneda: monedaPorDefecto, monto: "", metodo_id: "", referencia: "", pagado_por: "", nota: "" },
    guardarAbono, onCerrar,
  );
  const moneda = form.watch("moneda");
  const saldo = saldos[moneda] ?? 0;
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={abono ? "Editar abono" : "Abonar al proveedor"}
      descripcion={`Saldo pendiente en ${moneda}: ${formatearMonto(saldo, moneda)}`}>
      <CampoTexto etiqueta="Fecha" type="date" error={err.fecha?.message} {...form.register("fecha")} />
      <CampoSelect etiqueta="Moneda" {...form.register("moneda")}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta={`Monto (${moneda})`} requerido inputMode="decimal" error={err.monto?.message}
        ayuda={saldo > 0 ? <button type="button" className="text-primary underline" onClick={() => form.setValue("monto", String(saldo))}>Pagar todo ({formatearMonto(saldo, moneda)})</button> : undefined}
        {...form.register("monto")} />
      <CampoSelect etiqueta="Método de pago" {...form.register("metodo_id")}>
        <option value="">—</option>
        {metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Referencia" {...form.register("referencia")} />
      <CampoTexto etiqueta="Pagado por" placeholder="Quién entregó el dinero" {...form.register("pagado_por")} />
      <CampoTexto etiqueta="Nota" className="sm:col-span-2" {...form.register("nota")} />
    </DialogoFormulario>
  );
}

export function DialogoCestas({
  proveedorId, hoy, registro, onCerrar,
}: { proveedorId: number; hoy: string; registro?: CestasEditable; onCerrar: () => void }) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaCestas,
    registro
      ? { ...registro, proveedor_id: proveedorId, entregadas: registro.entregadas || "", devueltas: registro.devueltas || "", nota: registro.nota ?? "" }
      : { proveedor_id: proveedorId, fecha: hoy, entregadas: "", devueltas: "", nota: "" },
    guardarCestas, onCerrar,
  );
  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={registro ? "Editar cestas" : "Movimiento de cestas"} descripcion="Cestas que entregó el proveedor y las que se le devolvieron.">
      <CampoTexto etiqueta="Fecha" type="date" className="sm:col-span-2" error={err.fecha?.message} {...form.register("fecha")} />
      <CampoTexto etiqueta="Entregadas" inputMode="numeric" error={err.entregadas?.message} {...form.register("entregadas")} />
      <CampoTexto etiqueta="Devueltas" inputMode="numeric" error={err.devueltas?.message} {...form.register("devueltas")} />
      <CampoTexto etiqueta="Nota" className="sm:col-span-2" {...form.register("nota")} />
    </DialogoFormulario>
  );
}
