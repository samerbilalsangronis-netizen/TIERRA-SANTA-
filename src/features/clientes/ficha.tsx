"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, Ban, Banknote, CheckCheck, Coins, Eye, FilePlus2, FileText, HandCoins, MoreHorizontal, Package, Paperclip,
  Pencil, Power, Printer, Receipt, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Decimal, dec, formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { ESTADOS_PAGO, numeroFactura } from "@/lib/facturas";
import { cn } from "@/lib/utils";
import { anularFactura, aplicarSaldoAFavor, cambiarActivoCliente, eliminarCliente, eliminarEmpaque, eliminarPago } from "./acciones";
import { DialogoCliente, type ClienteEditable } from "./dialogo-cliente";
import { DialogoPago, type FacturaPagable, type PagoEditable, type SeleccionInicial } from "./dialogo-pago";
import { DialogoEmpaque, DialogoFacturaExterna, type EmpaqueEditable, type FacturaExternaEditable } from "./dialogos-cliente";
import { BadgeEstadoCliente } from "./lista";

type Factura = {
  id: number; origen: string; numero: number | null; numero_externo: string | null; fecha: string; moneda: string;
  total: number; pagado: number; saldo: number; estado: string; estado_pago: string; observaciones: string | null;
  soporte_url: string | null; soporte_path: string | null; motivo_anulacion: string | null; soporte: string | null;
};
type Pago = {
  id: number; numero: number; fecha: string; moneda: string; monto: number; tipo: string; metodo_id: number | null;
  referencia: string | null; nota: string | null; metodos_pago: { nombre: string } | null; pago_aplicaciones: { factura_id: number; monto: number }[];
};
type Empaque = EmpaqueEditable & { factura_id: number | null };
type Saldo = { moneda: string; pendiente: number; aFavor: number; saldo: number; facturas: number };
type Pendiente = { id: number; origen: string; numero: number | null; numero_externo: string | null; fecha: string; moneda: string; total: number; saldo: number };

type Dialogo =
  | { tipo: "pago"; moneda: string; seleccion?: SeleccionInicial[]; pago?: PagoEditable }
  | { tipo: "externa"; factura?: FacturaExternaEditable } | { tipo: "empaque"; registro?: EmpaqueEditable }
  | { tipo: "cliente" } | { tipo: "detalle"; factura: Factura } | { tipo: "anular"; factura: Factura }
  | { tipo: "eliminar"; texto: string; accion: () => Promise<{ ok: boolean; error?: string; mensaje?: string }> } | null;

function BadgeEstadoPago({ estado }: { estado: string }) {
  const e = ESTADOS_PAGO[estado] ?? ESTADOS_PAGO.pendiente;
  return <Badge variant="outline" className={e.clase}>{e.texto}</Badge>;
}

/** Antigüedad de lo pendiente (días desde la fecha de la factura). */
function antiguedad(pendientes: Pendiente[], moneda: string, hoy: string) {
  const tramos = [0, 0, 0, 0];
  for (const f of pendientes.filter((p) => p.moneda === moneda && Number(p.saldo) > 0)) {
    const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${f.fecha}T00:00:00Z`)) / 86_400_000);
    tramos[dias <= 15 ? 0 : dias <= 30 ? 1 : dias <= 60 ? 2 : 3] += Number(f.saldo);
  }
  return tramos;
}

export function FichaCliente(props: {
  cliente: ClienteEditable; estado: string; cajas: { retiradas: number; devueltas: number; pendientes: number };
  saldos: Saldo[]; facturas: Factura[]; pendientes: Pendiente[]; pagos: Pago[]; empaques: Empaque[];
  metodos: { id: number; nombre: string }[]; monedas: string[]; prefijo: string;
  filtros: { estado: string; moneda: string; desde: string; hasta: string }; hoy: string;
  permisos: { editar: boolean; cobrar: boolean; facturar: boolean; eliminar: boolean; esAdmin: boolean };
}) {
  const { cliente, estado, cajas, saldos, facturas, pendientes, pagos, empaques, metodos, monedas, prefijo, filtros, hoy, permisos } = props;
  const router = useRouter();
  const ruta = usePathname();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const cerrar = () => setDialogo(null);

  const doc = (f: { origen: string; numero: number | null; numero_externo: string | null }) => numeroFactura(f, prefijo);
  const facturasPagables: FacturaPagable[] = pendientes.map((f) => ({ id: f.id, documento: doc(f), fecha: f.fecha, moneda: f.moneda, total: Number(f.total), saldo: Number(f.saldo) }));
  const aFavor = Object.fromEntries(saldos.map((s) => [s.moneda, s.aFavor]));
  const monedasCliente = saldos.length ? saldos.map((s) => s.moneda) : ["USD"];
  const nombreFactura = useMemo(
    () => new Map<number, string>([...pendientes, ...facturas].map((f) => [f.id, numeroFactura(f, prefijo)])),
    [pendientes, facturas, prefijo],
  );

  // Selección múltiple: todas de la misma moneda
  const monedaMarcada = facturas.find((f) => marcadas.has(f.id))?.moneda;
  const totalMarcado = facturas.filter((f) => marcadas.has(f.id)).reduce((a, f) => a.plus(dec(f.saldo)), new Decimal(0));
  const alternarMarca = (f: Factura) => setMarcadas((p) => { const n = new Set(p); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; });

  function filtrar(c: Partial<typeof filtros>) {
    const f = { ...filtros, ...c };
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }
  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) { toast.success(r.mensaje ?? "Listo."); router.refresh(); } else toast.error(r.error);
      cerrar();
    });
  }
  const abrirPago = (moneda: string, seleccion?: SeleccionInicial[]) => setDialogo({ tipo: "pago", moneda, seleccion });

  const historialFactura = (facturaId: number) =>
    pagos.flatMap((p) => p.pago_aplicaciones.filter((a) => a.factura_id === facturaId).map((a) => ({ pago: p, monto: a.monto })));

  const menuFactura = (f: Factura) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones de la factura ${doc(f)}`}><MoreHorizontal className="size-4" /></Button>} />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => setDialogo({ tipo: "detalle", factura: f })}><Eye className="size-4" /> Ver pagos de la factura</DropdownMenuItem>
        {f.soporte && <DropdownMenuItem render={<a href={f.soporte} target="_blank" rel="noreferrer" />}><Paperclip className="size-4" /> Ver soporte</DropdownMenuItem>}
        {permisos.cobrar && f.estado === "emitida" && Number(f.saldo) > 0 && (aFavor[f.moneda] ?? 0) > 0 && (
          <DropdownMenuItem onClick={() => ejecutar(() => aplicarSaldoAFavor(f.id))}><Coins className="size-4" /> Aplicar saldo a favor</DropdownMenuItem>
        )}
        {permisos.facturar && f.origen === "externa" && f.estado === "emitida" && (
          <DropdownMenuItem onClick={() => setDialogo({ tipo: "externa", factura: { ...f } })}><Pencil className="size-4" /> Editar</DropdownMenuItem>
        )}
        {permisos.facturar && f.estado === "emitida" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => { setMotivo(""); setDialogo({ tipo: "anular", factura: f }); }}><Ban className="size-4" /> Anular</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const botonesPago = (f: Factura, compacto = false) =>
    permisos.cobrar && f.estado === "emitida" && Number(f.saldo) > 0 ? (
      <div className={cn("flex gap-1.5", compacto && "w-full")}>
        <Button size="sm" variant="outline" className={cn("border-success/40 text-success", compacto && "flex-1")}
          onClick={() => abrirPago(f.moneda, [{ id: f.id, completa: true }])}>
          <CheckCheck className="size-3.5" /> Pagar completa
        </Button>
        <Button size="sm" variant="outline" className={cn(compacto && "flex-1")} onClick={() => abrirPago(f.moneda, [{ id: f.id, completa: false }])}>
          <HandCoins className="size-3.5" /> Abonar
        </Button>
      </div>
    ) : null;

  const casilla = (f: Factura) => {
    const pagable = permisos.cobrar && f.estado === "emitida" && Number(f.saldo) > 0;
    const bloqueada = Boolean(monedaMarcada && monedaMarcada !== f.moneda);
    return pagable ? (
      <Checkbox checked={marcadas.has(f.id)} disabled={bloqueada} onCheckedChange={() => alternarMarca(f)}
        aria-label={`Marcar factura ${doc(f)}`} title={bloqueada ? `Solo facturas en ${monedaMarcada}` : undefined} />
    ) : <span className="inline-block size-4" />;
  };

  return (
    <>
      <Link href="/clientes" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      {/* Encabezado y saldos */}
      <section className="mb-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/12 font-mono font-bold text-primary">
            <span className="text-[9px] font-normal text-muted-foreground">Nº</span>{cliente.numero}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-lg font-bold sm:text-2xl">{cliente.nombre}</h1>
              <BadgeEstadoCliente estado={estado} />
              {!cliente.activo && <Badge variant="outline">Inactivo</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{[cliente.documento, cliente.telefono, cliente.correo].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
            {cliente.direccion && <p className="text-xs text-muted-foreground">{cliente.direccion}</p>}
            {cliente.notas && <p className="mt-1 text-xs text-muted-foreground">{cliente.notas}</p>}
          </div>
          {(permisos.editar || permisos.eliminar) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Opciones del cliente"><MoreHorizontal className="size-4" /></Button>} />
              <DropdownMenuContent align="end" className="w-52">
                {permisos.editar && <DropdownMenuItem onClick={() => setDialogo({ tipo: "cliente" })}><Pencil className="size-4" /> Editar datos</DropdownMenuItem>}
                {permisos.editar && <DropdownMenuItem onClick={() => ejecutar(() => cambiarActivoCliente(cliente.id, !cliente.activo))}><Power className="size-4" /> {cliente.activo ? "Desactivar" : "Activar"}</DropdownMenuItem>}
                {permisos.eliminar && (<><DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDialogo({ tipo: "eliminar", texto: `al cliente ${cliente.nombre}`,
                    accion: async () => { const r = await eliminarCliente(cliente.id); if (r.ok) router.push("/clientes"); return r; } })}>
                    <Trash2 className="size-4" /> Eliminar cliente
                  </DropdownMenuItem></>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {monedasCliente.map((m) => {
            const s = saldos.find((x) => x.moneda === m) ?? { pendiente: 0, aFavor: 0, saldo: 0, facturas: 0 };
            const tramos = antiguedad(pendientes, m, hoy);
            return (
              <div key={m} className={cn("rounded-xl border p-3", s.saldo > 0 ? "border-warning/40 bg-warning/5" : "border-success/30 bg-success/5")}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.saldo > 0 ? `Debe (${m})` : s.saldo < 0 ? `A favor del cliente (${m})` : `Saldo ${m}`}</p>
                <p className={cn("tabular text-xl font-bold", s.saldo > 0 ? "text-warning" : "text-success")}>{formatearMonto(Math.abs(s.saldo), m)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.facturas} factura{s.facturas === 1 ? "" : "s"} pendiente{s.facturas === 1 ? "" : "s"}
                  {s.aFavor > 0 && ` · ${formatearMonto(s.aFavor, m)} a favor`}
                </p>
                {s.pendiente > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]" title="Antigüedad del saldo pendiente">
                    {["0–15 d", "16–30 d", "31–60 d", "+60 d"].map((t, i) => (
                      <div key={t} className={cn("rounded-md bg-background/60 px-1 py-0.5", i === 3 && tramos[3] > 0 && "text-destructive")}>
                        <p className="text-muted-foreground">{t}</p>
                        <p className="tabular font-semibold">{tramos[i] ? formatearMonto(tramos[i], m, { sinCodigo: true }) : "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-xl border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cajas pendientes</p>
            <p className="tabular text-xl font-bold">{cajas.pendientes}</p>
            <p className="text-[11px] text-muted-foreground">{cajas.retiradas} retiradas · {cajas.devueltas} devueltas</p>
          </div>
        </div>

        <div className="no-print mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {permisos.cobrar && <Button size="lg" className="bg-success text-black hover:bg-success/85" onClick={() => abrirPago(monedasCliente.find((m) => (saldos.find((s) => s.moneda === m)?.pendiente ?? 0) > 0) ?? monedasCliente[0])}><Banknote className="size-4" /> Registrar pago</Button>}
          {permisos.facturar && <Button size="lg" variant="outline" onClick={() => setDialogo({ tipo: "externa" })}><FilePlus2 className="size-4" /> Factura histórica</Button>}
          {permisos.editar && <Button size="lg" variant="outline" onClick={() => setDialogo({ tipo: "empaque" })}><Package className="size-4" /> Cajas</Button>}
          {monedasCliente.map((m) => (
            <Link key={m} href={`/clientes/${cliente.id}/estado-cuenta?moneda=${m}`} className={buttonVariants({ size: "lg", variant: "outline", className: "min-w-0" })}>
              <FileText className="size-4" /> <span className="truncate"><span className="sm:hidden">Cuenta</span><span className="hidden sm:inline">Estado de cuenta</span> {monedasCliente.length > 1 ? m : ""}</span>
            </Link>
          ))}
        </div>
      </section>

      <Tabs defaultValue="facturas">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="facturas">Facturas ({facturas.length})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos ({pagos.filter((p) => p.tipo === "pago").length})</TabsTrigger>
          <TabsTrigger value="cajas">Cajas ({empaques.length})</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ Facturas */}
        <TabsContent value="facturas" className="mt-3 space-y-3 pb-20">
          <div className="no-print flex flex-wrap items-center gap-1.5">
            {[["", "Todas"], ["pendiente", "Pendientes"], ["abonada", "Abonadas"], ["pagada", "Pagadas"], ["anulada", "Anuladas"]].map(([v, t]) => (
              <button key={v || "todas"} type="button" onClick={() => filtrar({ estado: v })}
                className={cn("rounded-full border px-3 py-1 text-xs", filtros.estado === v ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground")}>{t}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {["", ...monedas].map((m) => (
              <button key={m || "mon"} type="button" onClick={() => filtrar({ moneda: m })}
                className={cn("rounded-full border px-3 py-1 text-xs", filtros.moneda === m ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground")}>{m || "Todas las monedas"}</button>
            ))}
            <div className="flex items-center gap-1.5">
              <Input type="date" value={filtros.desde} onChange={(e) => filtrar({ desde: e.target.value })} className="h-8 w-[9.5rem] text-xs" aria-label="Desde" />
              <Input type="date" value={filtros.hasta} onChange={(e) => filtrar({ hasta: e.target.value })} className="h-8 w-[9.5rem] text-xs" aria-label="Hasta" />
            </div>
          </div>

          {facturas.length === 0 ? (
            <EstadoVacio icono={Receipt} titulo="Sin facturas" descripcion="Las facturas emitidas en Facturación aparecerán aquí. También puedes cargar facturas históricas." />
          ) : (
            <>
              {/* PC */}
              <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 p-3" /><th className="p-3">Factura</th><th className="p-3">Fecha</th>
                      <th className="p-3 text-right">Total</th><th className="p-3 text-right">Pagado</th><th className="p-3 text-right">Saldo</th>
                      <th className="p-3">Estado</th><th className="p-3" /><th className="w-10 p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {facturas.map((f) => (
                      <tr key={f.id} className={cn("align-middle", marcadas.has(f.id) && "bg-primary/5", f.estado === "anulada" && "opacity-60")}>
                        <td className="p-3">{casilla(f)}</td>
                        <td className="p-3">
                          <button type="button" className="font-mono font-semibold hover:text-primary" onClick={() => setDialogo({ tipo: "detalle", factura: f })}>{doc(f)}</button>
                          <span className="block text-[11px] text-muted-foreground">{f.origen === "externa" ? "Histórica" : "Sistema"}{f.soporte ? " · con soporte" : ""}</span>
                        </td>
                        <td className="whitespace-nowrap p-3">{formatearFecha(f.fecha)}</td>
                        <td className="tabular whitespace-nowrap p-3 text-right">{formatearMonto(f.total, f.moneda)}</td>
                        <td className="tabular whitespace-nowrap p-3 text-right text-success">{Number(f.pagado) ? formatearMonto(f.pagado, f.moneda, { sinCodigo: true }) : "—"}</td>
                        <td className="tabular whitespace-nowrap p-3 text-right font-semibold">{Number(f.saldo) ? formatearMonto(f.saldo, f.moneda, { sinCodigo: true }) : "—"}</td>
                        <td className="p-3"><BadgeEstadoPago estado={f.estado_pago} /></td>
                        <td className="p-3">{botonesPago(f)}</td>
                        <td className="p-3">{menuFactura(f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Teléfono */}
              <div className="space-y-2 md:hidden">
                {facturas.map((f) => (
                  <div key={f.id} className={cn("space-y-2 rounded-2xl border bg-card p-3", marcadas.has(f.id) && "border-primary/50 bg-primary/5", f.estado === "anulada" && "opacity-60")}>
                    <div className="flex items-start gap-2.5">
                      <div className="pt-1">{casilla(f)}</div>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDialogo({ tipo: "detalle", factura: f })}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">{doc(f)}</span>
                          <BadgeEstadoPago estado={f.estado_pago} />
                        </div>
                        <p className="text-xs text-muted-foreground">{formatearFecha(f.fecha)} · total {formatearMonto(f.total, f.moneda)}</p>
                        {Number(f.saldo) > 0 && <p className="tabular text-sm font-semibold text-warning">Saldo {formatearMonto(f.saldo, f.moneda)}</p>}
                      </button>
                      {menuFactura(f)}
                    </div>
                    {botonesPago(f, true)}
                  </div>
                ))}
              </div>
            </>
          )}

          {marcadas.size > 0 && monedaMarcada && (
            <div className="no-print fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-primary/40 bg-popover p-3 shadow-2xl lg:left-[17rem]">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{marcadas.size} factura{marcadas.size === 1 ? "" : "s"} marcada{marcadas.size === 1 ? "" : "s"}</p>
                <p className="tabular text-muted-foreground">Saldo {formatearMonto(totalMarcado, monedaMarcada)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMarcadas(new Set())}>Quitar</Button>
              <Button onClick={() => { abrirPago(monedaMarcada, [...marcadas].map((id) => ({ id, completa: true }))); }}>
                <Banknote className="size-4" /> Pagar
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------ Pagos */}
        <TabsContent value="pagos" className="mt-3">
          {pagos.length === 0 ? <EstadoVacio icono={Banknote} titulo="Sin pagos registrados" /> : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {pagos.map((p) => {
                const aplicado = p.pago_aplicaciones.reduce((a, x) => a + Number(x.monto), 0);
                const conversion = p.tipo === "conversion";
                return (
                  <li key={p.id} className={cn("flex items-start gap-3 px-3 py-2.5", conversion && "opacity-70")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {conversion ? "Conversión de moneda" : `Recibo nº ${p.numero}`} <span className="text-xs font-normal text-muted-foreground">· {formatearFecha(p.fecha)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conversion ? p.nota : [p.metodos_pago?.nombre, p.referencia && `Ref. ${p.referencia}`, p.nota].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {p.pago_aplicaciones.length > 0 && (
                        <p className="mt-0.5 text-xs">
                          {p.pago_aplicaciones.map((a) => `${nombreFactura.get(a.factura_id) ?? "factura"}: ${formatearMonto(a.monto, p.moneda, { sinCodigo: true })}`).join(" · ")}
                        </p>
                      )}
                      {!conversion && Number(p.monto) - aplicado > 0.004 && (
                        <p className="text-xs text-success">Saldo a favor: {formatearMonto(Number(p.monto) - aplicado, p.moneda)}</p>
                      )}
                    </div>
                    <p className={cn("tabular whitespace-nowrap font-semibold", Number(p.monto) < 0 ? "text-destructive" : "text-success")}>{formatearMonto(p.monto, p.moneda)}</p>
                    {!conversion && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones del recibo ${p.numero}`}><MoreHorizontal className="size-4" /></Button>} />
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem render={<Link href={`/clientes/${cliente.id}/recibos/${p.id}`} />}><Printer className="size-4" /> Ver / imprimir recibo</DropdownMenuItem>
                          {permisos.cobrar && (
                            <>
                              <DropdownMenuItem onClick={() => setDialogo({ tipo: "pago", moneda: p.moneda, pago: {
                                id: p.id, fecha: p.fecha, moneda: p.moneda, monto: Number(p.monto), metodo_id: p.metodo_id, referencia: p.referencia, nota: p.nota,
                                aplicaciones: p.pago_aplicaciones.map((a) => ({ factura_id: a.factura_id, monto: Number(a.monto) })),
                              } })}><Pencil className="size-4" /> Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDialogo({ tipo: "eliminar", texto: `el recibo nº ${p.numero} (${formatearMonto(p.monto, p.moneda)})`, accion: () => eliminarPago(p.id) })}>
                                <Trash2 className="size-4" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ------------------------------------------------ Cajas */}
        <TabsContent value="cajas" className="mt-3">
          {empaques.length === 0 ? <EstadoVacio icono={Package} titulo="Sin movimientos de cajas" /> : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {empaques.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0">{formatearFecha(e.fecha)}</span>
                  <span className="flex-1">
                    {e.retiradas > 0 && <span className="text-warning">+{e.retiradas} retiradas </span>}
                    {e.devueltas > 0 && <span className="text-success">−{e.devueltas} devueltas </span>}
                    {e.nota && <span className="text-xs text-muted-foreground">· {e.nota}</span>}
                  </span>
                  {permisos.editar && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones de cajas del ${formatearFecha(e.fecha)}`}><MoreHorizontal className="size-4" /></Button>} />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setDialogo({ tipo: "empaque", registro: e })}><Pencil className="size-4" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDialogo({ tipo: "eliminar", texto: `el movimiento de cajas del ${formatearFecha(e.fecha)}`, accion: () => eliminarEmpaque(e.id) })}>
                          <Trash2 className="size-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------ Diálogos */}
      {dialogo?.tipo === "pago" && (
        <DialogoPago clienteId={cliente.id} facturas={facturasPagables} monedas={monedas} saldoAFavor={aFavor} metodos={metodos} hoy={hoy}
          monedaInicial={dialogo.moneda} seleccion={dialogo.seleccion} pago={dialogo.pago}
          onCerrar={() => { cerrar(); setMarcadas(new Set()); }} />
      )}
      {dialogo?.tipo === "externa" && <DialogoFacturaExterna clienteId={cliente.id} monedas={monedas} hoy={hoy} factura={dialogo.factura} onCerrar={cerrar} />}
      {dialogo?.tipo === "empaque" && <DialogoEmpaque clienteId={cliente.id} hoy={hoy} registro={dialogo.registro} onCerrar={cerrar} />}
      {dialogo?.tipo === "cliente" && <DialogoCliente cliente={cliente} esAdmin={permisos.esAdmin} onCerrar={cerrar} />}

      <Dialog open={dialogo?.tipo === "detalle"} onOpenChange={(v) => !v && cerrar()}>
        <DialogContent className="sm:max-w-md">
          {dialogo?.tipo === "detalle" && (() => {
            const f = dialogo.factura;
            const historial = historialFactura(f.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Factura {doc(f)}</DialogTitle>
                  <DialogDescription>{formatearFecha(f.fecha)} · {f.origen === "externa" ? "histórica" : "emitida en el sistema"}</DialogDescription>
                </DialogHeader>
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Total</dt><dd className="tabular text-right">{formatearMonto(f.total, f.moneda)}</dd>
                  <dt className="text-muted-foreground">Pagado</dt><dd className="tabular text-right text-success">{formatearMonto(f.pagado, f.moneda)}</dd>
                  <dt className="font-semibold">Saldo</dt><dd className="tabular text-right font-semibold">{formatearMonto(f.saldo, f.moneda)}</dd>
                  <dt className="text-muted-foreground">Estado</dt><dd className="text-right"><BadgeEstadoPago estado={f.estado_pago} /></dd>
                </dl>
                {f.motivo_anulacion && <p className="text-sm text-destructive">Anulada: {f.motivo_anulacion}</p>}
                {f.observaciones && <p className="text-sm text-muted-foreground">{f.observaciones}</p>}
                <div>
                  <p className="mb-1 text-sm font-medium">Historial de pagos</p>
                  {historial.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos aplicados.</p> : (
                    <ul className="divide-y rounded-xl border text-sm">
                      {historial.map(({ pago, monto }) => (
                        <li key={pago.id} className="flex justify-between gap-2 px-3 py-2">
                          <span>{formatearFecha(pago.fecha)} · {pago.tipo === "conversion" ? "Conversión" : `Recibo ${pago.numero}`}{pago.metodos_pago ? ` · ${pago.metodos_pago.nombre}` : ""}</span>
                          <span className="tabular font-medium text-success">{formatearMonto(monto, f.moneda, { sinCodigo: true })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {permisos.cobrar && f.estado === "emitida" && Number(f.saldo) > 0 && (
                  <div className="flex gap-2">{botonesPago(f, true)}</div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialogo?.tipo === "anular"} onOpenChange={(v) => !v && cerrar()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular la factura {dialogo?.tipo === "anular" ? doc(dialogo.factura) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              La factura queda visible como ANULADA (no se borra), deja de sumar a la deuda y, si tenía pagos, quedan como saldo a favor del cliente.
              Si es del sistema, el inventario se devuelve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la anulación (obligatorio)" aria-label="Motivo de la anulación" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pendiente || motivo.trim().length < 3}
              onClick={() => dialogo?.tipo === "anular" && ejecutar(() => anularFactura(dialogo.factura.id, motivo))}>Anular factura</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogo?.tipo === "eliminar"} onOpenChange={(v) => !v && cerrar()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {dialogo?.tipo === "eliminar" ? dialogo.texto : ""}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Queda registrada en la bitácora de auditoría.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pendiente} onClick={() => dialogo?.tipo === "eliminar" && ejecutar(dialogo.accion)}>Eliminar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Ícono para estados vacíos de la lista */}
      <span className="hidden"><Users /></span>
    </>
  );
}
