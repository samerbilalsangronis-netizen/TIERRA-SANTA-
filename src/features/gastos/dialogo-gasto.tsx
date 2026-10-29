"use client";
import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { DialogoFormulario } from "@/components/comunes/dialogo-formulario";
import { useFormulario } from "@/components/comunes/use-formulario";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { guardarConcepto, guardarGasto } from "./acciones";
import { esquemaGasto } from "./esquemas";
import type { CatalogoGastos, Concepto, FilaGasto } from "./datos";

const NUEVO = "__nuevo__";
const texto = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** Registrar (o corregir) un gasto. Si el concepto no está en la lista, se agrega ahí mismo. */
export function DialogoGasto({ catalogo, gasto, hoy, onCerrar }: {
  catalogo: CatalogoGastos; gasto?: FilaGasto; hoy: string; onCerrar: () => void;
}) {
  const { form, enviar, pendiente, err } = useFormulario(
    esquemaGasto,
    gasto
      ? { id: gasto.id, fecha: gasto.fecha, concepto_id: gasto.concepto_id, cantidad: texto(gasto.cantidad), unidad: gasto.unidad ?? "",
          monto: texto(gasto.monto), moneda: gasto.moneda, metodo_id: gasto.metodo_id ?? "", lugar: gasto.lugar ?? "",
          pagado_por: gasto.pagado_por ?? "", nota: gasto.nota ?? "", foto_path: gasto.foto_path ?? "" }
      : { fecha: hoy, concepto_id: "", cantidad: "", unidad: "", monto: "", moneda: catalogo.monedaDefecto, metodo_id: "",
          lugar: "", pagado_por: "", nota: "", foto_path: "" },
    guardarGasto, onCerrar,
  );
  const [nuevos, setNuevos] = useState<Concepto[]>([]);
  const [creando, setCreando] = useState(false);
  const conceptos = [...catalogo.conceptos.filter((c) => c.activo || c.id === gasto?.concepto_id), ...nuevos];
  const registroConcepto = form.register("concepto_id");

  function elegirConcepto(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === NUEVO) { form.setValue("concepto_id", ""); setCreando(true); return; }
    registroConcepto.onChange(e);
    const c = conceptos.find((x) => String(x.id) === e.target.value);
    if (c) form.setValue("unidad", c.unidad);
  }

  return (
    <DialogoFormulario abierto onCerrar={onCerrar} pendiente={pendiente} onEnviar={enviar}
      titulo={gasto ? "Corregir gasto" : "Nuevo gasto"} descripcion="Lo que se compra y se paga en el momento (no es fruta).">
      <CampoTexto etiqueta="Fecha" type="date" requerido error={err.fecha?.message} {...form.register("fecha")} />
      {creando ? (
        <NuevoConcepto catalogo={catalogo} onCancelar={() => setCreando(false)}
          onCreado={(c) => { setNuevos((n) => [...n, c]); form.setValue("concepto_id", c.id); form.setValue("unidad", c.unidad); setCreando(false); }} />
      ) : (
        <CampoSelect etiqueta="Concepto" requerido error={err.concepto_id?.message} {...registroConcepto} onChange={elegirConcepto}>
          <option value="">Elige qué se compró…</option>
          {catalogo.categorias.map((cat) => {
            const lista = conceptos.filter((c) => c.categoria_id === cat.id);
            return lista.length ? (
              <optgroup key={cat.id} label={cat.nombre}>
                {lista.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </optgroup>
            ) : null;
          })}
          <option value={NUEVO}>+ Agregar otro concepto…</option>
        </CampoSelect>
      )}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <CampoTexto etiqueta="Cantidad" inputMode="decimal" placeholder="2" error={err.cantidad?.message} {...form.register("cantidad")} />
        <CampoSelect etiqueta="Unidad" {...form.register("unidad")}>
          <option value="">—</option>
          {catalogo.unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.codigo}</option>)}
        </CampoSelect>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <CampoTexto etiqueta="Monto pagado" requerido inputMode="decimal" placeholder="25.000" error={err.monto?.message} {...form.register("monto")} />
        <CampoSelect etiqueta="Moneda" {...form.register("moneda")}>
          {catalogo.monedas.map((m) => <option key={m} value={m}>{m}</option>)}
        </CampoSelect>
      </div>
      <CampoSelect etiqueta="Método de pago" {...form.register("metodo_id")}>
        <option value="">—</option>
        {catalogo.metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Dónde se compró" placeholder="Ferretería, bomba…" {...form.register("lugar")} />
      <CampoTexto etiqueta="Quién pagó" {...form.register("pagado_por")} />
      <CampoTexto etiqueta="Nota" {...form.register("nota")} />
      <SubirFoto ruta={form.watch("foto_path") || null} vistaPrevia={gasto?.foto_firmada ?? null}
        onCambio={(r) => form.setValue("foto_path", r ?? "")} />
    </DialogoFormulario>
  );
}

/** Agregar un concepto nuevo sin salir del formulario. */
function NuevoConcepto({ catalogo, onCreado, onCancelar }: { catalogo: CatalogoGastos; onCreado: (c: Concepto) => void; onCancelar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState(String(catalogo.categorias.find((c) => c.nombre === "Otros")?.id ?? catalogo.categorias[0]?.id ?? ""));
  const [unidad, setUnidad] = useState("und");
  const [pendiente, iniciar] = useTransition();
  const crear = () => iniciar(async () => {
    const r = await guardarConcepto({ nombre, categoria_id: categoria, unidad, activo: true });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.mensaje);
    onCreado({ id: r.datos.id, nombre: nombre.trim(), categoria_id: Number(categoria), unidad, activo: true });
  });
  return (
    <div className="space-y-2 rounded-xl border border-primary/40 p-3 sm:col-span-2">
      <p className="text-sm font-semibold">Nuevo concepto</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem_6rem]">
        <CampoTexto etiqueta="Nombre" placeholder="Detergente" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <CampoSelect etiqueta="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {catalogo.categorias.filter((c) => c.activa).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
          {catalogo.unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.codigo}</option>)}
        </CampoSelect>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button type="button" size="sm" disabled={pendiente || nombre.trim().length < 2} onClick={crear}>
          {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar concepto
        </Button>
      </div>
    </div>
  );
}

/** Foto de la factura o recibo (cámara en el teléfono), al bucket privado "gastos". */
function SubirFoto({ ruta, vistaPrevia, onCambio }: { ruta: string | null; vistaPrevia: string | null; onCambio: (ruta: string | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const imagen = local ?? (ruta ? vistaPrevia : null);
  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (archivo.size > 10 * 1024 * 1024) { toast.error("La foto supera 10 MB."); return; }
    setSubiendo(true);
    try {
      const ext = (archivo.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const destino = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await crearClienteNavegador().storage.from("gastos").upload(destino, archivo, { contentType: archivo.type, upsert: false });
      if (error) throw error;
      setLocal(archivo.type.startsWith("image/") ? URL.createObjectURL(archivo) : null);
      onCambio(destino);
      toast.success("Foto adjuntada.");
    } catch (err) {
      toast.error(`No se pudo subir: ${err instanceof Error ? err.message : "error"}`);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>Foto de la factura o recibo (opcional)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={entrada} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={elegir} />
        <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => entrada.current?.click()}>
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} {ruta ? "Cambiar foto" : "Tomar / subir foto"}
        </Button>
        {ruta && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setLocal(null); onCambio(null); }}><X className="size-4" /> Quitar</Button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local o firmada */}
        {imagen && <img src={imagen} alt="Foto del gasto" className="size-14 rounded-lg border object-cover" />}
        {ruta && !imagen && <span className="text-xs text-muted-foreground">Archivo adjunto</span>}
      </div>
    </div>
  );
}
