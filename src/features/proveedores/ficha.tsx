"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, Banknote, Camera, FileText, MoreHorizontal, Package, Pencil, Plus, Power, Trash2, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { formatearCantidad, formatearMonto, sumar } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import {
  cambiarActivoProveedor, eliminarAbono, eliminarCestas, eliminarEntrega, eliminarProveedor,
} from "./acciones";
import { DialogoEntrega, type EntregaEditable, type Rubro } from "./dialogo-entrega";
import { DialogoAbono, DialogoCestas, type AbonoEditable, type CestasEditable } from "./dialogos-pagos";
import { DialogoProveedor, type ProveedorEditable } from "./dialogo-proveedor";
import { SaldoMoneda } from "./lista";
import { NOMBRE_MODO, type ModoCompra } from "@/lib/calculos/entregas";

const PRECIO_POR: Record<ModoCompra, string> = { KG: "por kilo", UNIDAD: "por unidad", FIJO: "por cesta", VARIABLE: "total" };

function cantidadTexto(e: { modo_pesaje: string; kg_total: number; unidades: number; cestas: number; productos: { unidad: string; categoria: string } | null }) {
  if (e.modo_pesaje === "UNIDAD") return `${formatearCantidad(e.unidades)} ${e.productos?.categoria === "insumo" ? e.productos.unidad : "und"}`;
  if (e.modo_pesaje === "FIJO") return `${formatearCantidad(e.cestas)} cestas`;
  return `${formatearCantidad(e.kg_total)} kg`;
}

type Entrega = EntregaEditable & {
  precio_kg: number; desc_merma: number; total: number; peso_neto: number;
  productos: { codigo: number; nombre: string; emoji: string | null; unidad: string; categoria: string } | null;
};
type Abono = AbonoEditable & { numero: number; metodos_pago: { nombre: string } | null };
type Cestas = CestasEditable & { entrega_id: number | null };
type SaldoMonedaFila = { moneda: string | null; total_entregas: number | null; total_abonos: number | null; saldo: number | null; kg_total: number | null; merma: number | null };

type Dialogo =
  | { tipo: "entrega"; entrega?: Entrega } | { tipo: "abono"; abono?: Abono } | { tipo: "cestas"; registro?: Cestas }
  | { tipo: "proveedor" } | { tipo: "foto"; url: string; titulo: string }
  | { tipo: "eliminar"; texto: string; accion: () => Promise<{ ok: boolean; error?: string; mensaje?: string }> } | null;

export function FichaProveedor(props: {
  proveedor: ProveedorEditable;
  resumen: { cestas_pendientes: number | null; cestas_entregadas: number | null; cestas_devueltas: number | null; ultima_entrega: string | null } | null;
  saldos: SaldoMonedaFila[];
  entregas: Entrega[]; abonos: Abono[]; cestas: Cestas[];
  rubros: Rubro[]; monedas: string[]; metodos: { id: number; nombre: string }[];
  filtros: { moneda: string; desde: string; hasta: string };
  hoy: string;
  permisos: { editar: boolean; pagar: boolean; eliminarProveedor: boolean };
}) {
  const { proveedor, resumen, saldos, entregas, abonos, cestas, rubros, monedas, metodos, filtros, hoy, permisos } = props;
  const router = useRouter();
  const ruta = usePathname();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, iniciar] = useTransition();
  const cerrar = () => setDialogo(null);
  const usaCestas = proveedor.tipo !== "insumos";

  const saldoPor = useMemo(() => Object.fromEntries(saldos.map((s) => [s.moneda ?? "", Number(s.saldo ?? 0)])), [saldos]);
  const monedasConMovimiento = saldos.map((s) => s.moneda!).filter(Boolean);
  const monedasMostrar = monedasConMovimiento.length ? monedasConMovimiento : [proveedor.moneda_habitual];

  function filtrar(cambio: Partial<typeof filtros>) {
    const f = { ...filtros, ...cambio };
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>, despues?: () => void) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) { toast.success(r.mensaje ?? "Listo."); router.refresh(); despues?.(); } else toast.error(r.error);
      cerrar();
    });
  }

  const totalesEntregas = useMemo(() => {
    const m = new Map<string, { total: number; kg: number; merma: number; neto: number; cestas: number; n: number }>();
    for (const e of entregas) {
      const t = m.get(e.moneda) ?? { total: 0, kg: 0, merma: 0, neto: 0, cestas: 0, n: 0 };
      m.set(e.moneda, {
        total: sumar([t.total, e.total]).toNumber(), kg: sumar([t.kg, e.kg_total]).toNumber(), merma: sumar([t.merma, e.merma]).toNumber(),
        neto: sumar([t.neto, e.peso_neto]).toNumber(), cestas: sumar([t.cestas, e.cestas]).toNumber(), n: t.n + 1,
      });
    }
    return [...m.entries()];
  }, [entregas]);
  const totalesAbonos = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of abonos) m.set(a.moneda, sumar([m.get(a.moneda) ?? 0, a.monto]).toNumber());
    return [...m.entries()];
  }, [abonos]);

  const menuFila = (items: { texto: string; icono: typeof Pencil; accion: () => void; peligro?: boolean }[], etiqueta: string) =>
    items.length === 0 ? null : (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={etiqueta}><MoreHorizontal className="size-4" /></Button>} />
        <DropdownMenuContent align="end" className="w-44">
          {items.map((i) => (
            <DropdownMenuItem key={i.texto} variant={i.peligro ? "destructive" : "default"} onClick={i.accion}>
              <i.icono className="size-4" /> {i.texto}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const accionesEntrega = (e: Entrega) => [
    ...(e.foto_firmada ? [{ texto: "Ver foto", icono: Camera, accion: () => setDialogo({ tipo: "foto", url: e.foto_firmada!, titulo: `${e.productos?.nombre} · ${formatearFecha(e.fecha)}` }) }] : []),
    ...(permisos.editar ? [{ texto: "Editar", icono: Pencil, accion: () => setDialogo({ tipo: "entrega", entrega: e }) }] : []),
    ...(permisos.pagar ? [{ texto: "Eliminar", icono: Trash2, peligro: true, accion: () => setDialogo({ tipo: "eliminar", texto: `la entrega de ${e.productos?.nombre} del ${formatearFecha(e.fecha)} (${formatearMonto(e.total, e.moneda)})`, accion: () => eliminarEntrega(e.id) }) }] : []),
  ];
  const accionesAbono = (a: Abono) => permisos.pagar ? [
    { texto: "Editar", icono: Pencil, accion: () => setDialogo({ tipo: "abono", abono: a }) },
    { texto: "Eliminar", icono: Trash2, peligro: true, accion: () => setDialogo({ tipo: "eliminar", texto: `el abono de ${formatearMonto(a.monto, a.moneda)} del ${formatearFecha(a.fecha)}`, accion: () => eliminarAbono(a.id) }) },
  ] : [];
  const accionesCestas = (c: Cestas) => [
    ...(permisos.editar && !c.entrega_id ? [{ texto: "Editar", icono: Pencil, accion: () => setDialogo({ tipo: "cestas", registro: c }) }] : []),
    ...(permisos.pagar && !c.entrega_id ? [{ texto: "Eliminar", icono: Trash2, peligro: true, accion: () => setDialogo({ tipo: "eliminar", texto: `el movimiento de cestas del ${formatearFecha(c.fecha)}`, accion: () => eliminarCestas(c.id) }) }] : []),
  ];

  const estadoCuentaHref = (m: string) => {
    const qs = new URLSearchParams({ moneda: m, ...(filtros.desde && { desde: filtros.desde }), ...(filtros.hasta && { hasta: filtros.hasta }) });
    return `/proveedores/${proveedor.id}/estado-cuenta?${qs}`;
  };

  return (
    <>
      <Link href="/proveedores" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Proveedores
      </Link>

      {/* Encabezado */}
      <section className="mb-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Truck className="size-6" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-lg font-bold sm:text-2xl">{proveedor.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {[proveedor.documento, proveedor.telefono, proveedor.ubicacion].filter(Boolean).join(" · ") || "Sin datos de contacto"}
            </p>
            {!proveedor.activo && <Badge variant="outline" className="mt-1">Inactivo</Badge>}
            {proveedor.notas && <p className="mt-1 text-xs text-muted-foreground">{proveedor.notas}</p>}
          </div>
          {(permisos.editar || permisos.eliminarProveedor) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Opciones del proveedor"><MoreHorizontal className="size-4" /></Button>} />
              <DropdownMenuContent align="end" className="w-52">
                {permisos.editar && <DropdownMenuItem onClick={() => setDialogo({ tipo: "proveedor" })}><Pencil className="size-4" /> Editar datos</DropdownMenuItem>}
                {permisos.editar && (
                  <DropdownMenuItem onClick={() => ejecutar(() => cambiarActivoProveedor(proveedor.id, !proveedor.activo))}>
                    <Power className="size-4" /> {proveedor.activo ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                )}
                {permisos.eliminarProveedor && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDialogo({
                      tipo: "eliminar", texto: `al proveedor ${proveedor.nombre}`,
                      accion: async () => { const r = await eliminarProveedor(proveedor.id); if (r.ok) router.push("/proveedores"); return r; },
                    })}><Trash2 className="size-4" /> Eliminar proveedor</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {monedasMostrar.map((m) => (
            <div key={m} className={cn("rounded-xl border p-3", saldoPor[m] > 0 ? "border-warning/40 bg-warning/5" : "border-success/30 bg-success/5")}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{saldoPor[m] > 0 ? `Se le debe (${m})` : `Saldo ${m}`}</p>
              <SaldoMoneda valor={saldoPor[m] ?? 0} moneda={m} />
            </div>
          ))}
          {usaCestas && <div className="rounded-xl border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cestas pendientes</p>
            <p className="tabular font-semibold">{resumen?.cestas_pendientes ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{resumen?.cestas_entregadas ?? 0} entregadas · {resumen?.cestas_devueltas ?? 0} devueltas</p>
          </div>}
        </div>

        <div className="no-print mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {permisos.editar && <Button size="lg" onClick={() => setDialogo({ tipo: "entrega" })}><Plus className="size-4" /> Entrega</Button>}
          {permisos.pagar && <Button size="lg" variant="outline" className="border-success/40 text-success" onClick={() => setDialogo({ tipo: "abono" })}><Banknote className="size-4" /> Abonar</Button>}
          {permisos.editar && usaCestas && <Button size="lg" variant="outline" onClick={() => setDialogo({ tipo: "cestas" })}><Package className="size-4" /> Cestas</Button>}
          {monedasMostrar.map((m) => (
            <Link key={m} href={estadoCuentaHref(m)} className={buttonVariants({ size: "lg", variant: "outline", className: "min-w-0" })}>
              <FileText className="size-4" /> <span className="truncate"><span className="sm:hidden">Cuenta</span><span className="hidden sm:inline">Estado de cuenta</span> {monedasMostrar.length > 1 ? m : ""}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Filtros */}
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        {["", ...monedas].map((m) => (
          <button key={m || "todas"} type="button" onClick={() => filtrar({ moneda: m })}
            className={cn("rounded-full border px-3 py-1 text-xs", filtros.moneda === m ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground")}>
            {m || "Todas las monedas"}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <Input type="date" value={filtros.desde} onChange={(e) => filtrar({ desde: e.target.value })} className="h-8 w-[9.5rem] text-xs" aria-label="Desde" />
          <span className="text-xs text-muted-foreground">a</span>
          <Input type="date" value={filtros.hasta} onChange={(e) => filtrar({ hasta: e.target.value })} className="h-8 w-[9.5rem] text-xs" aria-label="Hasta" />
        </div>
      </div>

      <Tabs defaultValue="entregas">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="entregas">Entregas ({entregas.length})</TabsTrigger>
          <TabsTrigger value="abonos">Abonos ({abonos.length})</TabsTrigger>
          {usaCestas && <TabsTrigger value="cestas">Cestas ({cestas.length})</TabsTrigger>}
        </TabsList>

        {/* Entregas */}
        <TabsContent value="entregas" className="mt-3 space-y-3">
          {entregas.length === 0 ? <EstadoVacio icono={Truck} titulo="Sin entregas" descripcion="No hay entregas con estos filtros." /> : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead><TableHead>Rubro</TableHead><TableHead className="text-right">Cestas</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Merma</TableHead><TableHead className="text-right">Neto (kg)</TableHead>
                      <TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Desc. merma</TableHead><TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregas.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap">{formatearFecha(e.fecha)}</TableCell>
                        <TableCell>
                          <span className="font-medium">{e.productos?.emoji} {e.productos?.nombre}</span>
                          <span className="block text-[11px] text-muted-foreground">{NOMBRE_MODO[e.modo_pesaje as ModoCompra]}{e.modo_pesaje === "FIJO" ? ` · ${formatearCantidad(e.kg_por_cesta)} kg/c` : ""}{e.nota ? ` · ${e.nota}` : ""}</span>
                        </TableCell>
                        <TableCell className="tabular text-right">{Number(e.cestas) ? formatearCantidad(e.cestas) : "—"}</TableCell>
                        <TableCell className="tabular whitespace-nowrap text-right">{cantidadTexto(e)}</TableCell>
                        <TableCell className="tabular text-right">{Number(e.merma) ? `${formatearCantidad(e.merma)} ${e.modo_pesaje === "UNIDAD" ? "und" : "kg"}` : "—"}</TableCell>
                        <TableCell className="tabular text-right">{Number(e.peso_neto) ? formatearCantidad(e.peso_neto) : "—"}</TableCell>
                        <TableCell className="tabular text-right">
                          {formatearMonto(e.precio, e.moneda, { sinCodigo: true })}
                          <span className="block text-[11px] text-muted-foreground">{PRECIO_POR[e.modo_pesaje as ModoCompra]}</span>
                        </TableCell>
                        <TableCell className="tabular text-right text-destructive">{Number(e.desc_merma) > 0 ? `−${formatearMonto(e.desc_merma, e.moneda, { sinCodigo: true })}` : "—"}</TableCell>
                        <TableCell className="tabular whitespace-nowrap text-right font-semibold">{formatearMonto(e.total, e.moneda)}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          {e.foto_firmada && <Camera className="size-3.5 text-muted-foreground" aria-label="Con foto" />}
                          {menuFila(accionesEntrega(e), `Acciones de la entrega del ${formatearFecha(e.fecha)}`)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    {totalesEntregas.map(([m, t]) => (
                      <TableRow key={m}>
                        <TableCell colSpan={2} className="font-semibold">Total {m} ({t.n})</TableCell>
                        <TableCell className="tabular text-right">{formatearCantidad(t.cestas)}</TableCell>
                        <TableCell className="tabular text-right">{t.kg ? `${formatearCantidad(t.kg)} kg` : ""}</TableCell>
                        <TableCell />
                        <TableCell className="tabular text-right">{formatearCantidad(t.neto)}</TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="tabular whitespace-nowrap text-right font-bold">{formatearMonto(t.total, m)}</TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                  </TableFooter>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {entregas.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 rounded-2xl border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium">{e.productos?.emoji} {e.productos?.nombre}</p>
                        <p className="tabular font-semibold">{formatearMonto(e.total, e.moneda)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatearFecha(e.fecha)} · {cantidadTexto(e)} × {formatearMonto(e.precio, e.moneda, { sinCodigo: true })}
                        {Number(e.merma) > 0 && ` · ${e.modo_pesaje === "UNIDAD" ? "dañadas" : "merma"} ${formatearCantidad(e.merma)}`}
                      </p>
                      {(Number(e.peso_neto) > 0 || e.nota) && (
                        <p className="text-xs text-muted-foreground">{Number(e.peso_neto) > 0 ? `Neto ${formatearCantidad(e.peso_neto)} kg` : ""}{e.nota ? ` · ${e.nota}` : ""}</p>
                      )}
                    </div>
                    {e.foto_firmada && (
                      <button type="button" onClick={() => setDialogo({ tipo: "foto", url: e.foto_firmada!, titulo: `${e.productos?.nombre} · ${formatearFecha(e.fecha)}` })}
                        className="size-11 shrink-0 overflow-hidden rounded-lg border" aria-label="Ver foto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.foto_firmada} alt="" className="size-full object-cover" />
                      </button>
                    )}
                    {menuFila(accionesEntrega(e), `Acciones de la entrega del ${formatearFecha(e.fecha)}`)}
                  </div>
                ))}
                {totalesEntregas.map(([m, t]) => (
                  <p key={m} className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span>Total {m}{t.neto ? ` · ${formatearCantidad(t.neto)} kg netos` : ""}</span><b className="tabular">{formatearMonto(t.total, m)}</b>
                  </p>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Abonos */}
        <TabsContent value="abonos" className="mt-3 space-y-2">
          {abonos.length === 0 ? <EstadoVacio icono={Banknote} titulo="Sin abonos" descripcion="No hay abonos con estos filtros." /> : (
            <>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {abonos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatearFecha(a.fecha)} <span className="text-xs text-muted-foreground">· Recibo nº {a.numero}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[a.metodos_pago?.nombre, a.referencia && `Ref. ${a.referencia}`, a.pagado_por && `Pagó: ${a.pagado_por}`, a.nota].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <p className="tabular whitespace-nowrap font-semibold text-success">{formatearMonto(a.monto, a.moneda)}</p>
                    {menuFila(accionesAbono(a), `Acciones del abono del ${formatearFecha(a.fecha)}`)}
                  </li>
                ))}
              </ul>
              {totalesAbonos.map(([m, total]) => (
                <p key={m} className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                  <span>Total abonado {m}</span><b className="tabular">{formatearMonto(total, m)}</b>
                </p>
              ))}
            </>
          )}
        </TabsContent>

        {/* Cestas */}
        <TabsContent value="cestas" className="mt-3">
          {cestas.length === 0 ? <EstadoVacio icono={Package} titulo="Sin movimientos de cestas" /> : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {cestas.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0">{formatearFecha(c.fecha)}</span>
                  <span className="flex-1">
                    {c.entregadas > 0 && <span className="text-warning">+{c.entregadas} entregadas </span>}
                    {c.devueltas > 0 && <span className="text-success">−{c.devueltas} devueltas </span>}
                    <span className="text-xs text-muted-foreground">{c.entrega_id ? "· con la entrega" : c.nota ? `· ${c.nota}` : ""}</span>
                  </span>
                  {menuFila(accionesCestas(c), `Acciones de cestas del ${formatearFecha(c.fecha)}`)}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      {dialogo?.tipo === "entrega" && (
        <DialogoEntrega proveedorId={proveedor.id} rubros={rubros} monedas={monedas} monedaPorDefecto={proveedor.moneda_habitual}
          hoy={hoy} entrega={dialogo.entrega} onCerrar={cerrar} />
      )}
      {dialogo?.tipo === "abono" && (
        <DialogoAbono proveedorId={proveedor.id} monedas={monedas} metodos={metodos} monedaPorDefecto={proveedor.moneda_habitual}
          saldos={saldoPor} hoy={hoy} abono={dialogo.abono} onCerrar={cerrar} />
      )}
      {dialogo?.tipo === "cestas" && <DialogoCestas proveedorId={proveedor.id} hoy={hoy} registro={dialogo.registro} onCerrar={cerrar} />}
      {dialogo?.tipo === "proveedor" && <DialogoProveedor proveedor={proveedor} monedas={monedas} onCerrar={cerrar} />}
      <Dialog open={dialogo?.tipo === "foto"} onOpenChange={(v) => !v && cerrar()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{dialogo?.tipo === "foto" ? dialogo.titulo : ""}</DialogTitle></DialogHeader>
          {dialogo?.tipo === "foto" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dialogo.url} alt="Foto de la entrega" className="max-h-[70dvh] w-full rounded-xl object-contain" />
          )}
        </DialogContent>
      </Dialog>
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
    </>
  );
}
