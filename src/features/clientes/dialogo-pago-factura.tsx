"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { Decimal, formatearMonto, parsearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { registrarPago } from "./acciones";
import type { FacturaPagable } from "./dialogo-pago";

/** Pagar completa o abonar UNA factura: un solo campo de monto. */
export function DialogoPagoFactura({
  clienteId, factura, completa, metodos, hoy, onCerrar,
}: {
  clienteId: number; factura: FacturaPagable; completa: boolean; metodos: { id: number; nombre: string }[]; hoy: string; onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [monto, setMonto] = useState(completa ? String(factura.saldo) : "");
  const [fecha, setFecha] = useState(hoy);
  const [metodo, setMetodo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valor = parsearMonto(monto);
  const saldo = new Decimal(factura.saldo);
  const aplicado = valor ? Decimal.min(valor, saldo) : new Decimal(0);
  const excedente = valor ? valor.minus(saldo) : new Decimal(0);
  const queda = saldo.minus(aplicado);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valor || valor.lte(0)) { setError("Escribe el monto."); return; }
    iniciar(async () => {
      const r = await registrarPago({
        cliente_id: clienteId, fecha, moneda: factura.moneda, monto: valor.toNumber(), metodo_id: metodo, referencia, nota,
        aplicaciones: [{ factura_id: factura.id, monto: aplicado.toNumber() }],
      });
      if (!r.ok) { setError(r.error); return; }
      toast.success(r.mensaje);
      router.refresh();
      onCerrar();
    });
  }

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={completa ? `Pagar factura ${factura.documento}` : `Abonar a la factura ${factura.documento}`}
      textoGuardar={completa ? "Registrar pago" : "Registrar abono"}
      resumenPie={valor && valor.gt(0) ? (
        <p className="flex items-baseline justify-between gap-3 text-sm sm:justify-start">
          <span className="text-muted-foreground">La factura queda en</span>
          <b className="tabular text-base">{queda.lte(0) ? "Pagada" : formatearMonto(queda, factura.moneda)}</b>
        </p>
      ) : undefined}>
      <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-center text-sm sm:col-span-2">
        <div><p className="text-[11px] text-muted-foreground">Fecha</p><p>{formatearFecha(factura.fecha)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Total</p><p className="tabular">{formatearMonto(factura.total, factura.moneda, { sinCodigo: true })}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Debe</p><p className="tabular font-semibold text-warning">{formatearMonto(factura.saldo, factura.moneda, { sinCodigo: true })}</p></div>
      </div>
      <CampoTexto etiqueta={`Monto ${completa ? "a pagar" : "a abonar"} (${factura.moneda})`} requerido inputMode="decimal" autoFocus
        className="sm:col-span-2" value={monto} onChange={(e) => setMonto(e.target.value)}
        ayuda={excedente.gt(0) ? `El excedente (${formatearMonto(excedente, factura.moneda)}) se descuenta de las otras facturas pendientes del cliente.` : undefined} />
      <CampoTexto etiqueta="Fecha del pago" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <CampoSelect etiqueta="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        <option value="">—</option>
        {metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      <CampoTexto etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
    </DialogoFormulario>
  );
}
