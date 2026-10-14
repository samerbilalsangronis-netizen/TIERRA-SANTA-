"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { Decimal, dec, formatearMonto, parsearMonto } from "@/lib/dinero";
import { repartirPago } from "@/lib/calculos/factura";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { registrarPago } from "./acciones";

export type FacturaPagable = { id: number; documento: string; fecha: string; moneda: string; total: number; saldo: number };
export type PagoEditable = {
  id: number; fecha: string; moneda: string; monto: number; metodo_id: number | null; referencia: string | null; nota: string | null;
  aplicaciones: { factura_id: number; monto: number }[];
};
export type SeleccionInicial = { id: number; completa: boolean };

type Fila = { sel: boolean; completa: boolean; monto: string };

export function DialogoPago({
  clienteId, facturas, monedas, saldoAFavor, metodos, hoy, monedaInicial, seleccion = [], pago, onCerrar, alGuardar,
}: {
  clienteId: number; facturas: FacturaPagable[]; monedas: string[]; saldoAFavor: Record<string, number>;
  metodos: { id: number; nombre: string }[]; hoy: string; monedaInicial: string; seleccion?: SeleccionInicial[];
  pago?: PagoEditable; onCerrar: () => void; alGuardar?: (id: number) => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [moneda, setMoneda] = useState(pago?.moneda ?? monedaInicial);
  const [fecha, setFecha] = useState(pago?.fecha ?? hoy);
  const [metodo, setMetodo] = useState(pago?.metodo_id ? String(pago.metodo_id) : "");
  const [referencia, setReferencia] = useState(pago?.referencia ?? "");
  const [nota, setNota] = useState(pago?.nota ?? "");
  const [recibido, setRecibido] = useState(pago ? String(pago.monto) : "");
  const [error, setError] = useState<string | null>(null);

  // Facturas de la moneda; al editar, lo ya aplicado por este pago vuelve a estar disponible
  const previo = useMemo(() => new Map((pago?.aplicaciones ?? []).map((a) => [a.factura_id, Number(a.monto)])), [pago]);
  const lista = useMemo(
    () => facturas
      .filter((f) => f.moneda === moneda && (Number(f.saldo) > 0 || previo.has(f.id)))
      .map((f) => ({ ...f, maximo: dec(f.saldo).plus(previo.get(f.id) ?? 0).toNumber() }))
      .sort((a, b) => (a.fecha === b.fecha ? a.id - b.id : a.fecha < b.fecha ? -1 : 1)),
    [facturas, moneda, previo],
  );

  const [filas, setFilas] = useState<Record<number, Fila>>(() => {
    const ini: Record<number, Fila> = {};
    for (const s of seleccion) ini[s.id] = { sel: true, completa: s.completa, monto: "" };
    for (const [id, m] of previo) ini[id] = { sel: true, completa: false, monto: String(m) };
    return ini;
  });

  const montoDe = (f: { id: number; maximo: number }) => {
    const r = filas[f.id];
    if (!r?.sel) return new Decimal(0);
    if (r.completa) return dec(f.maximo);
    return parsearMonto(r.monto) ?? new Decimal(0);
  };
  const aplicado = lista.reduce((a, f) => a.plus(montoDe(f)), new Decimal(0));
  const recibidoDec = recibido.trim() ? parsearMonto(recibido) : aplicado;
  const sobrante = recibidoDec ? recibidoDec.minus(aplicado) : new Decimal(0);
  const seleccionadas = lista.filter((f) => filas[f.id]?.sel);
  const excedidas = lista.filter((f) => montoDe(f).gt(f.maximo));

  const VACIA: Fila = { sel: false, completa: false, monto: "" };
  const cambiarFila = (id: number, cambio: Partial<Fila>) =>
    setFilas((p) => ({ ...p, [id]: { ...VACIA, ...p[id], ...cambio } }));

  function repartir() {
    const monto = parsearMonto(recibido);
    if (!monto || monto.lte(0)) { setError("Escribe primero el monto recibido."); return; }
    setError(null);
    const base = seleccionadas.length ? seleccionadas : lista;
    const { reparto } = repartirPago(monto, base.map((f) => ({ id: f.id, fecha: f.fecha, saldo: f.maximo })));
    const nuevo: Record<number, Fila> = {};
    for (const r of reparto) nuevo[r.facturaId] = { sel: true, completa: r.completa, monto: r.completa ? "" : r.monto.toString() };
    setFilas(nuevo);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!recibidoDec || recibidoDec.lte(0)) { setError("Indica el monto recibido o selecciona facturas."); return; }
    if (excedidas.length) { setError(`El monto de ${excedidas[0].documento} supera su saldo.`); return; }
    if (sobrante.lt(0)) { setError("Lo aplicado a facturas supera el monto recibido."); return; }
    const aplicaciones = lista
      .map((f) => ({ factura_id: f.id, monto: montoDe(f).toNumber() }))
      .filter((a) => a.monto > 0);
    iniciar(async () => {
      const r = await registrarPago({
        id: pago?.id, cliente_id: clienteId, fecha, moneda, monto: recibidoDec.toNumber(),
        metodo_id: metodo, referencia, nota, aplicaciones,
      });
      if (!r.ok) { setError(r.error); toast.error(r.error); return; }
      toast.success(r.mensaje);
      router.refresh();
      alGuardar?.(r.datos.id);
      onCerrar();
    });
  }

  const favor = saldoAFavor[moneda] ?? 0;

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={pago ? "Editar pago" : "Registrar pago"} textoGuardar={pago ? "Guardar" : "Registrar pago"}
      descripcion="Un pago se aplica solo a facturas de su misma moneda. Lo que sobre queda como saldo a favor."
      resumenPie={
        <div className="flex items-baseline justify-between gap-3 text-sm sm:justify-start">
          <span className="text-muted-foreground">Recibir</span>
          <b className="tabular text-base text-success">{recibidoDec ? formatearMonto(recibidoDec, moneda) : "—"}</b>
        </div>
      }>
      <CampoTexto etiqueta="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <CampoSelect etiqueta="Moneda" value={moneda} disabled={Boolean(pago)}
        onChange={(e) => { setMoneda(e.target.value); setFilas({}); setRecibido(""); }}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        <option value="">—</option>
        {metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="monto-recibido" className="text-sm font-medium">Monto recibido ({moneda})</label>
        <div className="flex gap-2">
          <Input id="monto-recibido" name="monto" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)}
            placeholder={aplicado.gt(0) ? aplicado.toString() : "0"} className="text-base font-semibold" />
          <Button type="button" variant="outline" onClick={repartir} title="Aplica el monto de la factura más vieja a la más nueva">
            <Wand2 className="size-4" /> <span className="hidden sm:inline">Repartir automáticamente</span><span className="sm:hidden">Repartir</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Si lo dejas vacío se usa la suma de lo marcado. {seleccionadas.length > 0 ? "El reparto usa solo las facturas marcadas." : "El reparto usa todas las pendientes."}
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <p className="text-sm font-medium">Facturas pendientes en {moneda}</p>
        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
            No hay facturas pendientes en {moneda}. Todo el pago quedará como saldo a favor.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {lista.map((f) => {
              const r = filas[f.id];
              const m = montoDe(f);
              return (
                <li key={f.id} className={cn("space-y-2 p-2.5", r?.sel && "bg-primary/5")}>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox checked={Boolean(r?.sel)} onCheckedChange={(v) => cambiarFila(f.id, { sel: Boolean(v), completa: Boolean(v) })}
                      aria-label={`Seleccionar factura ${f.documento}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{f.documento}</span>
                      <span className="block text-xs text-muted-foreground">{formatearFecha(f.fecha)} · total {formatearMonto(f.total, moneda, { sinCodigo: true })}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[11px] text-muted-foreground">Saldo</span>
                      <span className="tabular text-sm font-semibold text-warning">{formatearMonto(f.maximo, moneda, { sinCodigo: true })}</span>
                    </span>
                  </label>
                  {r?.sel && (
                    <div className="flex items-center gap-2 pl-7">
                      <div className="inline-flex rounded-lg border p-0.5 text-xs" role="radiogroup" aria-label="Tipo de pago">
                        <button type="button" role="radio" aria-checked={r.completa} onClick={() => cambiarFila(f.id, { completa: true })}
                          className={cn("rounded-md px-2.5 py-1", r.completa ? "bg-success/20 text-success" : "text-muted-foreground")}>Completa</button>
                        <button type="button" role="radio" aria-checked={!r.completa} onClick={() => cambiarFila(f.id, { completa: false })}
                          className={cn("rounded-md px-2.5 py-1", !r.completa ? "bg-primary/20 text-primary" : "text-muted-foreground")}>Abonar</button>
                      </div>
                      {r.completa ? (
                        <span className="tabular ml-auto text-sm font-semibold">{formatearMonto(m, moneda)}</span>
                      ) : (
                        <Input inputMode="decimal" value={r.monto} onChange={(e) => cambiarFila(f.id, { monto: e.target.value })}
                          placeholder="Monto a abonar" aria-label={`Monto a abonar a ${f.documento}`}
                          className={cn("ml-auto h-9 max-w-40 text-right", m.gt(f.maximo) && "border-destructive")} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border bg-muted/30 p-3 text-sm sm:col-span-2" aria-live="polite">
        <dt className="text-muted-foreground">Aplicado a {seleccionadas.length} factura{seleccionadas.length === 1 ? "" : "s"}</dt>
        <dd className="tabular text-right">{formatearMonto(aplicado, moneda)}</dd>
        <dt className="text-muted-foreground">Monto recibido</dt>
        <dd className="tabular text-right">{recibidoDec ? formatearMonto(recibidoDec, moneda) : "—"}</dd>
        {sobrante.gt(0) && (<><dt className="text-success">Queda como saldo a favor</dt><dd className="tabular text-right text-success">{formatearMonto(sobrante, moneda)}</dd></>)}
        {sobrante.lt(0) && <dd className="col-span-2 text-destructive">Lo aplicado supera lo recibido en {formatearMonto(sobrante.abs(), moneda)}.</dd>}
        {favor > 0 && !pago && (
          <dd className="col-span-2 text-xs text-muted-foreground">
            El cliente ya tiene {formatearMonto(favor, moneda)} a favor; se puede aplicar desde cada factura con «Aplicar saldo a favor».
          </dd>
        )}
      </dl>
      <CampoTexto etiqueta="Nota" className="sm:col-span-2" value={nota} onChange={(e) => setNota(e.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
    </DialogoFormulario>
  );
}
