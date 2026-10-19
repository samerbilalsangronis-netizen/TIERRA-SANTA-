"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Save, Search, Send, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/comunes/campos";
import { Decimal, formatearCantidad, formatearMonto, formatearNumero, parsearMonto } from "@/lib/dinero";
import { calcularTotales } from "@/lib/calculos/factura";
import { cn } from "@/lib/utils";
import { DialogoCliente } from "@/features/clientes/dialogo-cliente";
import { datosCliente, guardarFactura, ultimosPrecios } from "./acciones";
import type { ClienteFactura, DatosFormularioFactura, ProductoFactura } from "./datos";

export type FacturaInicial = {
  id?: number; cliente_id: number | null; fecha: string; moneda: string; condicion: "contado" | "credito";
  ubicacion_id: number | null; observaciones: string; iva_pct: number;
  lineas: { producto_id: number; cantidad: number; precio_unitario: number; aplica_iva: boolean }[];
};

type Linea = { clave: number; texto: string; productoId: number | null; cantidad: string; precio: string; iva: boolean };
type Campo = "codigo" | "cantidad" | "precio";

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const numeroTexto = (n: number) => formatearCantidad(n, 4);
let secuencia = 0;
const lineaVacia = (): Linea => ({ clave: ++secuencia, texto: "", productoId: null, cantidad: "", precio: "", iva: false });

/**
 * Pantalla de emisión / edición de facturas.
 * Teclado: en el código Enter elige el producto y pasa a la cantidad; Enter pasa al precio;
 * Enter en el precio crea la línea siguiente.
 */
export function FormularioFactura({
  datos, hoy, inicial, modo, numero, pagadoActual = 0, devolver = {}, esAdmin,
}: {
  datos: DatosFormularioFactura; hoy: string; inicial?: FacturaInicial;
  /** nueva = emitir (o guardar borrador) · borrador = continuar un borrador · editar = factura emitida */
  modo: "nueva" | "borrador" | "editar";
  numero?: string; pagadoActual?: number;
  /** Cantidades que la factura que se edita ya descontó (se suman a lo disponible). */
  devolver?: Record<number, number>;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const { productos, ubicaciones, monedas, metodos, empresa } = datos;
  const [clientes, setClientes] = useState<ClienteFactura[]>(datos.clientes);
  const [clienteId, setClienteId] = useState<number | null>(inicial?.cliente_id ?? null);
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [moneda, setMoneda] = useState(inicial?.moneda ?? (monedas.includes(empresa.moneda_defecto) ? empresa.moneda_defecto : monedas[0] ?? "USD"));
  const [condicion, setCondicion] = useState<"contado" | "credito">(inicial?.condicion ?? "credito");
  const ubicacionDefecto = ubicaciones.find((u) => u.predeterminada)?.id ?? ubicaciones[0]?.id ?? null;
  // Si la ubicación guardada ya no está activa, se usa la principal
  const [ubicacionId, setUbicacionId] = useState<number | null>(
    inicial?.ubicacion_id && ubicaciones.some((u) => u.id === inicial.ubicacion_id) ? inicial.ubicacion_id : ubicacionDefecto);
  /** Con una sola ubicación no se muestra nada de ubicaciones. */
  const variasUbicaciones = ubicaciones.length > 1;
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? "");
  const [ivaPct, setIvaPct] = useState(numeroTexto(inicial?.iva_pct ?? empresa.iva_pct));
  const [lineas, setLineas] = useState<Linea[]>(() => {
    const desde = (inicial?.lineas ?? []).map((l): Linea => {
      const p = productos.find((x) => x.id === l.producto_id);
      return { clave: ++secuencia, texto: p ? String(p.codigo) : "", productoId: l.producto_id, cantidad: numeroTexto(l.cantidad), precio: numeroTexto(l.precio_unitario), iva: l.aplica_iva };
    });
    return [...desde, lineaVacia()];
  });
  const [cajas, setCajas] = useState("");
  const [pagoCompleto, setPagoCompleto] = useState(false);
  const [montoPago, setMontoPago] = useState("");
  const [metodoId, setMetodoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tasa, setTasa] = useState("");
  const [preciosCargados, setPreciosCargados] = useState<{ clave: string; mapa: Record<number, number> }>({ clave: "", mapa: {} });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [accion, setAccion] = useState<"emitir" | "borrador" | "editar" | null>(null);

  // ----------------------------------------------------------------- foco por teclado
  const refs = useRef(new Map<string, HTMLInputElement>());
  // enfoca ya si el campo existe; si no (línea nueva), después de que React la pinte
  const setEnfocar = (k: string) => {
    const ahora = refs.current.get(k);
    if (ahora) { ahora.focus(); ahora.select(); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = refs.current.get(k);
      if (el) { el.focus(); el.select(); }
    }));
  };
  const registrar = (clave: number, campo: Campo) => (el: HTMLInputElement | null) => {
    const k = `${clave}-${campo}`;
    if (el) refs.current.set(k, el); else refs.current.delete(k);
  };

  // ----------------------------------------------------------------- últimos precios del cliente
  const clavePrecios = clienteId ? `${clienteId}-${moneda}` : "";
  useEffect(() => {
    if (!clienteId) return;
    let vigente = true;
    ultimosPrecios(clienteId, moneda).then((mapa) => { if (vigente) setPreciosCargados({ clave: `${clienteId}-${moneda}`, mapa }); }).catch(() => undefined);
    return () => { vigente = false; };
  }, [clienteId, moneda]);
  const precios = preciosCargados.clave === clavePrecios ? preciosCargados.mapa : {};

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const porCodigo = useMemo(() => new Map(productos.map((p) => [String(p.codigo), p])), [productos]);

  // ----------------------------------------------------------------- cálculos
  const valores = lineas.map((l) => ({ cantidad: parsearMonto(l.cantidad), precio: parsearMonto(l.precio) }));
  const usadas = lineas.map((l, i) => ({ l, v: valores[i] })).filter(({ l }) => l.productoId);
  const totales = calcularTotales(
    usadas.map(({ l, v }) => ({ cantidad: v.cantidad ?? 0, precioUnitario: v.precio ?? 0, aplicaIva: l.iva })),
    parsearMonto(ivaPct) ?? 0,
  );
  const hayIva = usadas.some(({ l }) => l.iva);

  const disponible = (productoId: number) =>
    (ubicacionId ? datos.stock[ubicacionId]?.[productoId] ?? 0 : 0) + (devolver[productoId] ?? 0);
  /** Stock del producto en las OTRAS ubicaciones (para avisar si está en otro lado). */
  const enOtras = (productoId: number) =>
    ubicaciones.filter((u) => u.id !== ubicacionId && (datos.stock[u.id]?.[productoId] ?? 0) > 0)
      .map((u) => ({ id: u.id, nombre: u.nombre, cantidad: datos.stock[u.id][productoId] }));
  const requerido = new Map<number, Decimal>();
  lineas.forEach((l, i) => {
    if (l.productoId && valores[i].cantidad) requerido.set(l.productoId, (requerido.get(l.productoId) ?? new Decimal(0)).plus(valores[i].cantidad!));
  });
  // Mientras no se active el control de inventario, la factura no descuenta: no se avisa de stock
  const controlaStock = empresa.inventario_desde !== null;
  const faltantes = controlaStock ? [...requerido.entries()].filter(([id, cant]) => cant.gt(disponible(id))) : [];
  const bloqueaStock = empresa.stock_insuficiente === "bloquear" && faltantes.length > 0;

  const monedaOriginal = inicial?.moneda;
  const cambiaMonedaConPagos = modo === "editar" && pagadoActual > 0 && moneda !== monedaOriginal;
  const montoCobro = pagoCompleto ? totales.total : parsearMonto(montoPago) ?? new Decimal(0);

  // ----------------------------------------------------------------- líneas
  const cambiarLinea = (clave: number, cambio: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));

  function elegirProducto(clave: number, p: ProductoFactura, pasar = true) {
    setLineas((ls) => {
      const nuevas = ls.map((l) => {
        if (l.clave !== clave) return l;
        const sugerido = precios[p.id];
        return { ...l, productoId: p.id, texto: String(p.codigo), precio: l.precio || (sugerido !== undefined ? numeroTexto(sugerido) : "") };
      });
      // siempre queda una línea vacía al final
      return nuevas[nuevas.length - 1].productoId ? [...nuevas, lineaVacia()] : nuevas;
    });
    setErrores((e) => { const n = { ...e }; delete n[`l${clave}`]; return n; });
    if (pasar) setEnfocar(`${clave}-cantidad`);
  }

  function siguienteLinea(clave: number) {
    const i = lineas.findIndex((l) => l.clave === clave);
    const sig = lineas[i + 1];
    if (sig) setEnfocar(`${sig.clave}-codigo`);
    else { const n = lineaVacia(); flushSync(() => setLineas((ls) => [...ls, n])); setEnfocar(`${n.clave}-codigo`); }
  }

  function quitarLinea(clave: number) {
    setLineas((ls) => {
      const resto = ls.filter((l) => l.clave !== clave);
      return resto.length && !resto[resto.length - 1].productoId ? resto : [...resto, lineaVacia()];
    });
  }

  function cambiarMoneda(m: string) {
    if (m === moneda) return;
    if (modo === "editar" && pagadoActual > 0 && m !== monedaOriginal && empresa.cambio_moneda_con_pagos === "bloquear") {
      toast.error(`La factura tiene pagos en ${monedaOriginal}: el cambio de moneda está bloqueado en Configuración.`);
      return;
    }
    setMoneda(m);
  }

  // ----------------------------------------------------------------- guardar
  function validar(): string | null {
    const e: Record<string, string> = {};
    if (!clienteId) e.cliente = "Elige el cliente";
    if (usadas.length === 0) e.lineas = "Agrega al menos un producto";
    lineas.forEach((l, i) => {
      if (!l.productoId) { if (l.texto.trim()) e[`l${l.clave}`] = "Código no encontrado"; return; }
      if (!valores[i].cantidad || valores[i].cantidad!.lte(0)) e[`l${l.clave}-cantidad`] = "Cantidad";
      if (!valores[i].precio || valores[i].precio!.lt(0)) e[`l${l.clave}-precio`] = "Precio";
    });
    if (parsearMonto(ivaPct) === null) e.iva = "IVA no válido";
    if (cambiaMonedaConPagos && !(parsearMonto(tasa)?.gt(0))) e.tasa = "Escribe la tasa";
    setErrores(e);
    return Object.keys(e).length ? (e.cliente ?? e.lineas ?? e.tasa ?? "Revisa las líneas marcadas en rojo.") : null;
  }

  function enviar(que: "emitir" | "borrador" | "editar") {
    const error = validar();
    if (error) { toast.error(error); return; }
    if (que !== "borrador" && bloqueaStock) { toast.error("No hay stock suficiente para emitir (bloqueado en Configuración)."); return; }
    setAccion(que);
    iniciar(async () => {
      const r = await guardarFactura({
        id: inicial?.id, modo: que, cliente_id: clienteId ?? "", fecha, moneda, condicion, ubicacion_id: ubicacionId,
        observaciones, iva_pct: ivaPct,
        lineas: usadas.map(({ l, v }) => ({ producto_id: l.productoId!, cantidad: v.cantidad?.toNumber() ?? 0, precio_unitario: v.precio?.toNumber() ?? 0, aplica_iva: l.iva })),
        cajas, pago: { monto: que === "emitir" ? montoCobro.toNumber() : null, metodo_id: metodoId, referencia },
        motivo, tasa_conversion: cambiaMonedaConPagos ? tasa : null,
      });
      setAccion(null);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.datos.numero && que === "emitir" ? `Factura ${empresa.factura_prefijo}${String(r.datos.numero).padStart(6, "0")} emitida.` : r.mensaje);
      for (const a of r.datos.advertencias) toast.warning(`Stock insuficiente · ${a}`, { duration: 8000 });
      router.push(que === "borrador" ? "/facturacion?estado=borrador" : `/facturacion/${r.datos.id}`);
      router.refresh();
    });
  }

  const titulo = modo === "editar" ? `Editar ${empresa.titulo_documento.toLowerCase()} ${numero ?? ""}` : modo === "borrador" ? "Continuar borrador" : `Nueva ${empresa.titulo_documento.toLowerCase()}`;

  return (
    <div className="pb-28" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(modo === "editar" ? "editar" : "emitir"); } }}>
      <Link href="/facturacion" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Facturación
      </Link>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-xl font-bold sm:text-2xl">{titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {modo === "editar" ? "Se conserva el número. Cada cambio queda en el historial." : "El número se asigna solo al emitir."}
        </p>
      </div>

      {/* ------------------------------------------------ Cliente y datos generales */}
      <section className="mb-4 grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-1.5">
          <Label>Cliente<span className="text-destructive">*</span></Label>
          {cliente ? (
            <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 font-mono text-sm font-bold text-primary">
                <span className="text-[9px] font-normal text-muted-foreground">Nº</span>{cliente.numero}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold" data-testid="cliente-elegido">{cliente.nombre}</p>
                <p className="text-xs text-muted-foreground">{[cliente.documento, cliente.telefono].filter(Boolean).join(" · ") || "Sin cédula/RIF ni teléfono"}</p>
                {cliente.direccion && <p className="text-xs text-muted-foreground">{cliente.direccion}</p>}
              </div>
              {(modo !== "editar" || pagadoActual === 0) && (
                <Button variant="ghost" size="sm" onClick={() => setClienteId(null)}><X className="size-3.5" /> Cambiar</Button>
              )}
            </div>
          ) : (
            <BuscadorCliente clientes={clientes} error={errores.cliente}
              onElegir={(c) => { setClienteId(c.id); setErrores((e) => ({ ...e, cliente: "" })); setEnfocar(`${lineas[0].clave}-codigo`); }}
              onNuevo={() => setNuevoCliente(true)} />
          )}
        </div>

        <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-2", variasUbicaciones ? "sm:grid-cols-4 2xl:grid-cols-4" : "sm:grid-cols-3 2xl:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1 lg:[&>*:first-child]:col-span-2 2xl:[&>*:first-child]:col-span-1")}>
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <div className="flex h-10 rounded-lg border p-0.5 sm:h-9" role="radiogroup" aria-label="Moneda">
              {monedas.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={moneda === m} onClick={() => cambiarMoneda(m)}
                  className={cn("flex-1 rounded-md text-sm font-semibold transition-colors", moneda === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Condición</Label>
            <div className="flex h-10 rounded-lg border p-0.5 sm:h-9" role="radiogroup" aria-label="Condición de pago">
              {(["credito", "contado"] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={condicion === c}
                  onClick={() => { setCondicion(c); if (modo !== "editar") setPagoCompleto(c === "contado"); }}
                  className={cn("flex-1 rounded-md text-sm transition-colors", condicion === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {c === "credito" ? "Crédito" : "Contado"}
                </button>
              ))}
            </div>
          </div>
          {variasUbicaciones && <div className="space-y-1.5">
            <Label htmlFor="ubicacion">Sale de</Label>
            <SelectNativo id="ubicacion" value={ubicacionId ?? ""} onChange={(e) => setUbicacionId(e.target.value ? Number(e.target.value) : null)}>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </SelectNativo>
          </div>}
        </div>
      </section>

      {cambiaMonedaConPagos && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-3 text-sm">
          <p className="min-w-0 flex-1">
            La factura tiene <b>{formatearMonto(pagadoActual, monedaOriginal ?? "USD")}</b> pagados. Para pasarla a {moneda} los pagos se convierten con esta tasa.
          </p>
          <div className="w-44 space-y-1">
            <Label htmlFor="tasa">1 {monedaOriginal} = ? {moneda}</Label>
            <Input id="tasa" inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} aria-invalid={!!errores.tasa} placeholder="Ej. 4.000" />
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Líneas */}
      <section className="mb-4 rounded-2xl border bg-card">
        <div className="hidden grid-cols-[5.5rem_minmax(0,1fr)_7.5rem_8.5rem_3.5rem_9rem_2.5rem] gap-2 border-b px-3 py-2 text-xs text-muted-foreground md:grid">
          <span>Código</span><span>Producto</span><span className="text-right">Cantidad</span><span className="text-right">Precio</span>
          <span className="text-center">IVA</span><span className="text-right">Total</span><span />
        </div>
        <ul className="divide-y">
          {lineas.map((l, i) => {
            const p = l.productoId ? porId.get(l.productoId) : undefined;
            const v = valores[i];
            const total = l.productoId && v.cantidad && v.precio ? totales.lineas[usadas.findIndex((u) => u.l.clave === l.clave)] : null;
            const disp = p ? disponible(p.id) : 0;
            const falta = p && controlaStock ? (requerido.get(p.id) ?? new Decimal(0)).gt(disp) : false;
            const sugerido = p ? precios[p.id] : undefined;
            return (
              <li key={l.clave} className="grid grid-cols-6 items-center gap-2 px-3 py-2.5 md:grid-cols-[5.5rem_minmax(0,1fr)_7.5rem_8.5rem_3.5rem_9rem_2.5rem]" data-testid="linea-factura">
                <div className="col-span-2 md:col-span-1">
                  <CeldaCodigo linea={l} productos={productos} porCodigo={porCodigo} refCampo={registrar(l.clave, "codigo")} invalido={!!errores[`l${l.clave}`]}
                    onTexto={(t) => {
                      const exacto = /^\d+$/.test(t.trim()) ? porCodigo.get(t.trim()) : undefined;
                      if (exacto) elegirProducto(l.clave, exacto, false);
                      else cambiarLinea(l.clave, { texto: t, productoId: null });
                    }}
                    onElegir={(prod) => elegirProducto(l.clave, prod)}
                    onEnterSinProducto={() => { if (!l.texto.trim() && usadas.length > 0) document.getElementById("boton-principal")?.focus(); }} />
                </div>
                <div className="col-span-3 min-w-0 md:col-span-1">
                  {p ? (
                    <>
                      <p className="truncate text-sm font-medium">{p.emoji ? `${p.emoji} ` : ""}{p.nombre}</p>
                      <p className={cn("text-[11px]", falta ? "font-medium text-warning" : "text-muted-foreground")}>
                        {!controlaStock ? null : falta ? <><AlertTriangle className="mr-0.5 inline size-3" />Solo hay {formatearCantidad(disp)} {p.unidad}</> : `Disponible ${formatearCantidad(disp)} ${p.unidad}`}
                        {falta && enOtras(p.id).map((o) => (
                          <button key={o.id} type="button" onClick={() => setUbicacionId(o.id)} className="ml-1 font-medium text-primary underline-offset-2 hover:underline"
                            title={`Cambiar "Sale de" a ${o.nombre}`}>
                            · hay {formatearCantidad(o.cantidad)} en {o.nombre}
                          </button>
                        ))}
                        {sugerido !== undefined && <>{controlaStock ? " · último" : "Último"} precio {formatearNumero(sugerido, 2)}</>}
                      </p>
                    </>
                  ) : (
                    <p className={cn("text-sm", errores[`l${l.clave}`] ? "text-destructive" : "text-muted-foreground")}>
                      {errores[`l${l.clave}`] ?? (l.texto ? "Elige de la lista…" : i === lineas.length - 1 ? "Escribe el código o el nombre" : "—")}
                    </p>
                  )}
                </div>
                <div className="order-3 flex justify-end md:order-none md:hidden">
                  {(l.productoId || l.texto) && (
                    <Button variant="ghost" size="icon" onClick={() => quitarLinea(l.clave)} aria-label={`Quitar línea ${i + 1}`}><Trash2 className="size-4" /></Button>
                  )}
                </div>
                <div className="order-4 col-span-2 md:order-none md:col-span-1">
                  <Input ref={registrar(l.clave, "cantidad")} inputMode="decimal" value={l.cantidad} placeholder={p ? p.unidad : "Cant."}
                    aria-label={`Cantidad línea ${i + 1}`} aria-invalid={!!errores[`l${l.clave}-cantidad`]} className="text-right tabular"
                    onChange={(e) => cambiarLinea(l.clave, { cantidad: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); setEnfocar(`${l.clave}-precio`); } }} />
                </div>
                <div className="order-5 col-span-2 md:order-none md:col-span-1">
                  <Input ref={registrar(l.clave, "precio")} inputMode="decimal" value={l.precio} placeholder="Precio"
                    aria-label={`Precio línea ${i + 1}`} aria-invalid={!!errores[`l${l.clave}-precio`]} className="text-right tabular"
                    onChange={(e) => cambiarLinea(l.clave, { precio: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); siguienteLinea(l.clave); } }} />
                </div>
                <label className="order-6 col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs md:order-none md:col-span-1 md:h-9 md:border-0">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={l.iva} onChange={(e) => cambiarLinea(l.clave, { iva: e.target.checked })}
                    aria-label={`IVA línea ${i + 1}`} />
                  <span className="md:hidden">IVA</span>
                </label>
                <p className={cn("order-7 col-span-6 text-right text-sm font-semibold tabular md:order-none md:col-span-1", !l.productoId && "hidden md:block")}>
                  {total ? formatearMonto(total, moneda, { sinCodigo: true }) : <span className="text-muted-foreground">—</span>}
                </p>
                <div className="hidden justify-end md:flex">
                  {(l.productoId || l.texto) && (
                    <Button variant="ghost" size="icon" onClick={() => quitarLinea(l.clave)} aria-label={`Quitar línea ${i + 1}`} tabIndex={-1}><Trash2 className="size-4" /></Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => siguienteLinea(lineas[lineas.length - 1].clave)}><Plus className="size-4" /> Agregar línea</Button>
          <p className="hidden text-[11px] text-muted-foreground md:block">Enter pasa al siguiente campo · Ctrl+Enter {modo === "editar" ? "guarda" : "emite"}</p>
        </div>
        {errores.lineas && <p className="px-3 pb-2 text-sm text-destructive">{errores.lineas}</p>}
      </section>

      {/* ------------------------------------------------ Cobro, notas y totales */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {modo !== "editar" && (
            <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_1fr]">
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="monto-cobro">Cobrado al entregar <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Button type="button" size="sm" variant={pagoCompleto ? "default" : "outline"} onClick={() => setPagoCompleto((v) => !v)}>
                    {pagoCompleto ? "Pagó completo ✓" : "Pagó completo"}
                  </Button>
                </div>
                <Input id="monto-cobro" inputMode="decimal" placeholder="0" disabled={pagoCompleto}
                  value={pagoCompleto ? formatearNumero(totales.total, moneda === "COP" ? 0 : 2) : montoPago} onChange={(e) => setMontoPago(e.target.value)} />
              </div>
              {montoCobro.gt(0) && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="metodo">Método</Label>
                    <SelectNativo id="metodo" value={metodoId} onChange={(e) => setMetodoId(e.target.value)}>
                      <option value="">—</option>
                      {metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </SelectNativo>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="referencia">Referencia</Label>
                    <Input id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cajas">Cajas que se lleva</Label>
                <Input id="cajas" inputMode="numeric" placeholder="0" value={cajas} onChange={(e) => setCajas(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1.5 rounded-2xl border bg-card p-4">
            <Label htmlFor="observaciones">Observaciones</Label>
            <textarea id="observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30" />
            {modo === "editar" && (
              <>
                <Label htmlFor="motivo" className="pt-2">Motivo del cambio <span className="font-normal text-muted-foreground">(queda en el historial)</span></Label>
                <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. el cliente devolvió 5 kg" />
              </>
            )}
          </div>
        </div>

        <dl className="h-fit space-y-1.5 rounded-2xl border bg-card p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatearMonto(totales.subtotal, moneda)}</dd></div>
          {hayIva && (
            <>
              <div className="flex justify-between"><dt className="text-muted-foreground">Base imponible</dt><dd className="tabular">{formatearMonto(totales.baseImponible, moneda, { sinCodigo: true })}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Exento</dt><dd className="tabular">{formatearMonto(totales.exento, moneda, { sinCodigo: true })}</dd></div>
            </>
          )}
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              IVA
              <Input aria-label="Porcentaje de IVA" inputMode="decimal" value={ivaPct} onChange={(e) => setIvaPct(e.target.value)}
                className="h-7 w-14 px-1.5 text-right text-xs" aria-invalid={!!errores.iva} />%
            </dt>
            <dd className="tabular">{formatearMonto(totales.iva, moneda, { sinCodigo: true })}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-2">
            <dt className="font-semibold">Total</dt><dd className="tabular text-xl font-bold" data-testid="total-factura">{formatearMonto(totales.total, moneda)}</dd>
          </div>
          {modo !== "editar" && montoCobro.gt(0) && (
            <div className="flex justify-between text-success"><dt>Cobrado</dt><dd className="tabular">{formatearMonto(montoCobro, moneda, { sinCodigo: true })}</dd></div>
          )}
          {modo === "editar" && pagadoActual > 0 && !cambiaMonedaConPagos && (
            <div className="flex justify-between text-success"><dt>Ya pagado</dt><dd className="tabular">{formatearMonto(pagadoActual, moneda, { sinCodigo: true })}</dd></div>
          )}
          {faltantes.length > 0 && (
            <p className={cn("rounded-lg px-2 py-1.5 text-xs", bloqueaStock ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
              <AlertTriangle className="mr-1 inline size-3.5" />
              {bloqueaStock ? "No hay stock suficiente: no se puede emitir." : "Hay productos sin stock suficiente. Se puede emitir igual."}
            </p>
          )}
        </dl>
      </section>

      {/* ------------------------------------------------ Barra fija con el total y los botones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-popover/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <div className="mr-auto min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="tabular truncate text-lg font-bold sm:text-xl">{formatearMonto(totales.total, moneda)}</p>
          </div>
          {modo !== "editar" && (
            <Button variant="outline" size="lg" disabled={pendiente} onClick={() => enviar("borrador")}>
              {accion === "borrador" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span className="hidden sm:inline">Guardar borrador</span><span className="sm:hidden">Borrador</span>
            </Button>
          )}
          <Button id="boton-principal" size="lg" disabled={pendiente || bloqueaStock} onClick={() => enviar(modo === "editar" ? "editar" : "emitir")}>
            {accion && accion !== "borrador" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {modo === "editar" ? "Guardar cambios" : `Emitir ${empresa.titulo_documento.toLowerCase()}`}
          </Button>
        </div>
      </div>

      {nuevoCliente && (
        <DialogoCliente esAdmin={esAdmin} onCerrar={() => setNuevoCliente(false)}
          alCrear={async (id) => {
            setNuevoCliente(false);
            const c = await datosCliente(id);
            if (c) {
              setClientes((cs) => [...cs, { ...c, numero: c.numero ?? 0 }]);
              setClienteId(c.id);
              setEnfocar(`${lineas[0].clave}-codigo`);
            }
          }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------- buscador de cliente
function BuscadorCliente({ clientes, error, onElegir, onNuevo }: {
  clientes: ClienteFactura[]; error?: string; onElegir: (c: ClienteFactura) => void; onNuevo: () => void;
}) {
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const resultados = useMemo(() => {
    const t = normalizar(q);
    if (!t) return [];
    const soloNumero = /^\d+$/.test(t);
    const exacto = soloNumero ? clientes.filter((c) => String(c.numero) === t) : [];
    const resto = clientes.filter((c) => !exacto.includes(c) && (
      normalizar(c.nombre).includes(t) || normalizar(c.documento ?? "").includes(t) || (soloNumero && String(c.numero).startsWith(t))));
    return [...exacto, ...resto].slice(0, 8);
  }, [q, clientes]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} placeholder="Nº de cliente, nombre o cédula/RIF" className="pl-8" aria-label="Buscar cliente"
            aria-invalid={!!error} role="combobox" aria-expanded={resultados.length > 0} aria-controls="lista-clientes"
            onChange={(e) => { setQ(e.target.value); setActivo(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, resultados.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); const c = resultados[activo]; if (c) onElegir(c); }
            }} />
        </div>
        <Button type="button" variant="outline" onClick={onNuevo}><UserPlus className="size-4" /> <span className="hidden sm:inline">Cliente nuevo</span><span className="sm:hidden">Nuevo</span></Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {q && (
        <ul id="lista-clientes" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">
          {resultados.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias. Usa “Cliente nuevo”.</li>}
          {resultados.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === activo}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onElegir(c)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm", i === activo ? "bg-primary/15" : "hover:bg-muted")}>
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">Nº {c.numero}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{c.nombre}</span>
                {c.documento && <span className="shrink-0 text-xs text-muted-foreground">{c.documento}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- celda de código de producto
function CeldaCodigo({ linea, productos, porCodigo, refCampo, invalido, onTexto, onElegir, onEnterSinProducto }: {
  linea: Linea; productos: ProductoFactura[]; porCodigo: Map<string, ProductoFactura>; refCampo: (el: HTMLInputElement | null) => void;
  invalido: boolean; onTexto: (t: string) => void; onElegir: (p: ProductoFactura) => void; onEnterSinProducto: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const t = normalizar(linea.texto);
  const sugerencias = useMemo(() => {
    if (!t || linea.productoId) return [];
    return productos.filter((p) => String(p.codigo).startsWith(t) || normalizar(p.nombre).includes(t)).slice(0, 8);
  }, [t, linea.productoId, productos]);

  return (
    <div className="relative">
      <Input ref={refCampo} value={linea.texto} placeholder="Código" aria-label="Código o nombre del producto" aria-invalid={invalido}
        className="font-mono" autoComplete="off"
        onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => { onTexto(e.target.value); setActivo(0); setAbierto(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, sugerencias.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && !e.ctrlKey) {
            e.preventDefault();
            const exacto = porCodigo.get(linea.texto.trim());
            const p = linea.productoId ? productos.find((x) => x.id === linea.productoId) : exacto ?? sugerencias[activo];
            if (p) { onElegir(p); setAbierto(false); } else onEnterSinProducto();
          }
        }} />
      {abierto && sugerencias.length > 0 && (
        <ul role="listbox" className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border bg-popover p-1 shadow-xl">
          {sugerencias.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === activo}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onElegir(p); setAbierto(false); }}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === activo ? "bg-primary/15" : "hover:bg-muted")}>
                <span className="w-8 font-mono text-xs text-muted-foreground">{p.codigo}</span>
                <span className="truncate">{p.emoji ? `${p.emoji} ` : ""}{p.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


