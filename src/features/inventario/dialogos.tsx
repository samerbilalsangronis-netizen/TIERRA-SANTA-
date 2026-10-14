"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftRight, ClipboardCheck, Factory, Loader2, PackageMinus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CampoArea, CampoSelect, CampoTexto, SelectNativo } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { formatearCantidad, parsearMonto } from "@/lib/dinero";
import { eliminarProduccion, registrarMovimiento } from "./acciones";

type Producto = { id: number; codigo: number; nombre: string; unidad: string; porUbicacion: Record<number, number> };
type Ubicacion = { id: number; nombre: string };
type Tipo = "merma" | "traslado" | "ajuste";

const TITULOS: Record<Tipo, { titulo: string; descripcion: string; boton: string }> = {
  merma: { titulo: "Registrar merma", descripcion: "Producto terminado que se perdió (dañado, descongelado, vencido…). Se descuenta del inventario.", boton: "Registrar merma" },
  traslado: { titulo: "Trasladar", descripcion: "Mover producto de una ubicación a otra. El total no cambia.", boton: "Trasladar" },
  ajuste: { titulo: "Ajuste por conteo", descripcion: "Escribe lo que contaste físicamente; el sistema registra la diferencia.", boton: "Guardar conteo" },
};

/** Botones de acciones del inventario (producción, merma, traslado, ajuste). */
export function AccionesInventario({ productos, ubicaciones, puedeOperar, puedeAjustar, productoInicial }: {
  productos: Producto[]; ubicaciones: Ubicacion[]; puedeOperar: boolean; puedeAjustar: boolean; productoInicial?: number;
}) {
  const [tipo, setTipo] = useState<Tipo | null>(null);
  if (!puedeOperar) return null;
  return (
    <>
      <Link href="/inventario/produccion" className={buttonVariants({ size: "lg", className: "bg-success text-black hover:bg-success/85" })}>
        <Factory className="size-4" /> Registrar producción
      </Link>
      <Button size="lg" variant="outline" onClick={() => setTipo("merma")}><PackageMinus className="size-4" /> Merma</Button>
      {ubicaciones.length > 1 && <Button size="lg" variant="outline" onClick={() => setTipo("traslado")}><ArrowLeftRight className="size-4" /> Traslado</Button>}
      {puedeAjustar && <Button size="lg" variant="outline" onClick={() => setTipo("ajuste")}><ClipboardCheck className="size-4" /> Ajuste</Button>}
      {tipo && <DialogoMovimiento tipo={tipo} productos={productos} ubicaciones={ubicaciones} productoInicial={productoInicial} onCerrar={() => setTipo(null)} />}
    </>
  );
}

function DialogoMovimiento({ tipo, productos, ubicaciones, productoInicial, onCerrar }: {
  tipo: Tipo; productos: Producto[]; ubicaciones: Ubicacion[]; productoInicial?: number; onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [productoId, setProductoId] = useState(String(productoInicial ?? ""));
  const [ubicacionId, setUbicacionId] = useState(String(ubicaciones[0]?.id ?? ""));
  const [destinoId, setDestinoId] = useState(String(ubicaciones[1]?.id ?? ""));
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const p = productos.find((x) => String(x.id) === productoId);
  const hay = p ? p.porUbicacion[Number(ubicacionId)] ?? 0 : null;
  const valor = parsearMonto(cantidad);
  const t = TITULOS[tipo];

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = await registrarMovimiento(
        tipo === "ajuste"
          ? { tipo, producto_id: productoId, ubicacion_id: ubicacionId, conteo: cantidad, motivo }
          : tipo === "traslado"
            ? { tipo, producto_id: productoId, ubicacion_id: ubicacionId, destino_id: destinoId, cantidad, motivo }
            : { tipo, producto_id: productoId, ubicacion_id: ubicacionId, cantidad, motivo },
      );
      if (!r.ok) { toast.error(r.error); setErrores(r.campos ?? {}); return; }
      toast.success(r.mensaje);
      router.refresh();
      onCerrar();
    });
  }

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar} titulo={t.titulo} descripcion={t.descripcion} textoGuardar={t.boton}
      resumenPie={p && hay !== null ? (
        <p className="text-sm text-muted-foreground">
          Hay <b className="text-foreground">{formatearCantidad(hay)} {p.unidad}</b>
          {valor && tipo === "merma" && <> · quedarán <b className="text-foreground">{formatearCantidad(hay - valor.toNumber())}</b></>}
          {valor && tipo === "ajuste" && <> · diferencia <b className="text-foreground">{formatearCantidad(valor.toNumber() - hay)}</b></>}
        </p>
      ) : undefined}>
      <CampoSelect etiqueta="Producto" requerido className="sm:col-span-2" value={productoId} onChange={(e) => setProductoId(e.target.value)} error={errores.producto_id}>
        <option value="">Elige…</option>
        {productos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nombre}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta={tipo === "traslado" ? "Desde" : "Ubicación"} value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)} error={errores.ubicacion_id}
        className={tipo === "traslado" ? "" : "sm:col-span-2"}>
        {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
      </CampoSelect>
      {tipo === "traslado" && (
        <CampoSelect etiqueta="Hacia" value={destinoId} onChange={(e) => setDestinoId(e.target.value)} error={errores.destino_id}>
          {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </CampoSelect>
      )}
      <CampoTexto etiqueta={tipo === "ajuste" ? `Cantidad contada${p ? ` (${p.unidad})` : ""}` : `Cantidad${p ? ` (${p.unidad})` : ""}`} requerido inputMode="decimal"
        className="sm:col-span-2" value={cantidad} onChange={(e) => setCantidad(e.target.value)} error={errores.cantidad ?? errores.conteo} autoFocus />
      <CampoArea etiqueta={tipo === "traslado" ? "Nota" : "Motivo"} requerido={tipo !== "traslado"} rows={2} className="sm:col-span-2"
        placeholder={tipo === "merma" ? "Ej. se descongeló por corte de luz" : tipo === "ajuste" ? "Ej. conteo del viernes" : ""}
        value={motivo} onChange={(e) => setMotivo(e.target.value)} error={errores.motivo} />
    </DialogoFormulario>
  );
}

/** Botón (solo admin) para borrar un registro de producción equivocado. */
export function BotonEliminarProduccion({ id, texto }: { id: number; texto: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={`Eliminar producción ${texto}`} onClick={() => { setMotivo(""); setAbierto(true); }}><Trash2 className="size-4" /></Button>
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la producción {texto}?</AlertDialogTitle>
            <AlertDialogDescription>Se quita del inventario lo que sumó. Úsalo solo si se registró por error. Queda en la auditoría.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" aria-label="Motivo" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={pendiente || motivo.trim().length < 3} onClick={() => iniciar(async () => {
              const r = await eliminarProduccion(id, motivo);
              if (r.ok) { toast.success(r.mensaje); setAbierto(false); router.refresh(); } else toast.error(r.error);
            })}>{pendiente && <Loader2 className="size-4 animate-spin" />} Eliminar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Filtros por URL (fechas, producto, tipo, ubicación) para movimientos, producción y kardex. */
export function FiltrosUrl({ valores, campos }: {
  valores: Record<string, string>;
  campos: ({ nombre: string; tipo: "fecha"; etiqueta: string } | { nombre: string; tipo: "select"; etiqueta: string; opciones: [string, string][] })[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const ir = (cambio: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries({ ...valores, ...cambio }).filter(([k, v]) => v && k !== "pagina"));
    router.replace(`${ruta}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  };
  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-1.5">
      {campos.map((c) => c.tipo === "fecha" ? (
        <Input key={c.nombre} type="date" aria-label={c.etiqueta} title={c.etiqueta} value={valores[c.nombre] ?? ""}
          onChange={(e) => ir({ [c.nombre]: e.target.value })} className="h-9 w-[9.5rem] text-xs" />
      ) : (
        <SelectNativo key={c.nombre} aria-label={c.etiqueta} value={valores[c.nombre] ?? ""} onChange={(e) => ir({ [c.nombre]: e.target.value })} className="h-9 w-auto max-w-[14rem]">
          {c.opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </SelectNativo>
      ))}
    </div>
  );
}
