"use client";
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, FileText, ImageUp, Loader2, Save, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { ConfirmarAccion } from "@/components/comunes/confirmar-accion";
import { NOMBRE_ROL, ROLES } from "@/lib/auth/roles";
import { guardarEmpresa, quitarLogo, subirLogo } from "./acciones-empresa";
import { esquemaEmpresa, MAX_LOGO_BYTES, TIPOS_LOGO, type DatosEmpresa, type DatosEmpresaValidos } from "./esquemas";

type Opcion = { valor: string; etiqueta: string };
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function Seccion({ titulo, icono: Icono, children }: { titulo: string; icono: typeof Building2; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><Icono className="size-4 text-primary" /> {titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Interruptor({ etiqueta, ayuda, checked, onChange }: { etiqueta: string; ayuda?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border bg-background/40 p-3 sm:col-span-2">
      <span>
        <span className="block text-sm font-medium">{etiqueta}</span>
        {ayuda && <span className="block text-xs text-muted-foreground">{ayuda}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </label>
  );
}

export function FormularioEmpresa({
  inicial, logoUrl, tieneLogoPropio, monedas, ubicaciones,
}: {
  inicial: DatosEmpresaValidos; logoUrl: string; tieneLogoPropio: boolean; monedas: Opcion[]; ubicaciones: Opcion[];
}) {
  const router = useRouter();
  const [guardando, iniciarGuardado] = useTransition();
  const [subiendo, iniciarSubida] = useTransition();
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const form = useForm<DatosEmpresa, unknown, DatosEmpresaValidos>({
    resolver: zodResolver(esquemaEmpresa),
    defaultValues: inicial,
  });
  const err = form.formState.errors;

  const enviar = form.handleSubmit((datos) =>
    iniciarGuardado(async () => {
      const r = await guardarEmpresa(datos);
      if (!r.ok) {
        toast.error(r.error);
        Object.entries(r.campos ?? {}).forEach(([k, m]) => form.setError(k as keyof DatosEmpresa, { message: m }));
        return;
      }
      toast.success(r.mensaje);
      form.reset(datos);
      router.refresh();
    }),
  );

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!TIPOS_LOGO.includes(archivo.type as (typeof TIPOS_LOGO)[number])) {
      toast.error("Formato no permitido. Usa PNG, JPG, WEBP o SVG.");
      return;
    }
    if (archivo.size > MAX_LOGO_BYTES) {
      toast.error("La imagen supera 5 MB.");
      return;
    }
    setVistaPrevia(URL.createObjectURL(archivo));
    const datos = new FormData();
    datos.set("logo", archivo);
    iniciarSubida(async () => {
      const r = await subirLogo(datos);
      if (!r.ok) {
        toast.error(r.error);
        setVistaPrevia(null);
      } else {
        toast.success(r.mensaje);
        router.refresh();
      }
      if (archivoRef.current) archivoRef.current.value = "";
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <section className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:p-5">
        <div className="relative h-32 w-52 shrink-0 overflow-hidden rounded-2xl border bg-[#0a0a0f] p-2">
          <Image src={vistaPrevia ?? logoUrl} alt="Logo de la empresa" fill sizes="128px" className="object-contain p-2" unoptimized />
          {subiendo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="size-6 animate-spin text-white" /></div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="font-semibold">Logo</h2>
          <p className="text-sm text-muted-foreground">Se muestra en la pantalla de inicio, el menú, las facturas y los recibos. PNG blanco con fondo transparente recomendado (la app es oscura); máx. 5 MB. Si no subes uno, se usa el logo oficial.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <input ref={archivoRef} type="file" accept={TIPOS_LOGO.join(",")} className="hidden" onChange={elegirArchivo} />
            <Button type="button" variant="outline" disabled={subiendo} onClick={() => archivoRef.current?.click()}>
              <ImageUp className="size-4" /> Subir logo
            </Button>
            {tieneLogoPropio && (
              <ConfirmarAccion
                titulo="¿Quitar el logo?"
                descripcion="Se volverá a usar el logo por defecto."
                textoConfirmar="Quitar"
                destructivo
                alConfirmar={async () => {
                  const r = await quitarLogo();
                  if (r.ok) { toast.success(r.mensaje); setVistaPrevia(null); router.refresh(); } else toast.error(r.error);
                }}
                disparador={<Button type="button" variant="ghost" className="text-destructive"><Trash2 className="size-4" /> Quitar</Button>}
              />
            )}
          </div>
        </div>
      </section>

      <Seccion titulo="Datos de la empresa" icono={Building2}>
        <CampoTexto etiqueta="Razón social" requerido className="sm:col-span-2" error={err.razon_social?.message} {...form.register("razon_social")} />
        <CampoTexto etiqueta="RIF / NIT" error={err.rif?.message} {...form.register("rif")} />
        <CampoTexto etiqueta="Teléfonos" error={err.telefonos?.message} {...form.register("telefonos")} />
        <CampoTexto etiqueta="Correo" type="email" error={err.correo?.message} {...form.register("correo")} />
        <CampoTexto etiqueta="Dirección" error={err.direccion?.message} {...form.register("direccion")} />
      </Seccion>

      <Seccion titulo="Facturación" icono={FileText}>
        <CampoTexto etiqueta="Título del documento" list="titulos-doc" error={err.titulo_documento?.message}
          ayuda="Factura, Nota de entrega, Pedido…" {...form.register("titulo_documento")} />
        <datalist id="titulos-doc"><option value="Factura" /><option value="Nota de entrega" /><option value="Pedido" /></datalist>
        <CampoTexto etiqueta="% IVA por defecto" inputMode="decimal" error={err.iva_pct?.message} {...form.register("iva_pct")} />
        <CampoSelect etiqueta="Moneda por defecto" {...form.register("moneda_defecto")}>
          {monedas.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
        </CampoSelect>
        <div className="grid grid-cols-2 gap-3">
          <CampoTexto etiqueta="Prefijo" placeholder="Ej. A-" error={err.factura_prefijo?.message} {...form.register("factura_prefijo")} />
          <CampoTexto etiqueta="Nº inicial" inputMode="numeric" error={err.factura_numero_inicial?.message} {...form.register("factura_numero_inicial")} />
        </div>
        <CampoArea etiqueta="Pie de factura" rows={2} className="sm:col-span-2" error={err.pie_factura?.message} {...form.register("pie_factura")} />
        <CampoArea etiqueta="Textos legales" rows={2} className="sm:col-span-2"
          ayuda="Se imprimen al pie. El sistema no certifica validez fiscal (requisitos SENIAT)." {...form.register("texto_legal")} />
      </Seccion>

      <Seccion titulo="Comportamiento" icono={Settings2}>
        <CampoSelect etiqueta="Si el stock no alcanza al facturar" {...form.register("stock_insuficiente")}>
          <option value="advertir">Solo advertir</option>
          <option value="bloquear">Bloquear la emisión</option>
        </CampoSelect>
        <CampoSelect etiqueta="Cambio de moneda en factura con pagos" {...form.register("cambio_moneda_con_pagos")}>
          <option value="convertir">Permitir, pidiendo tasa de cambio</option>
          <option value="bloquear">Bloquear el cambio</option>
        </CampoSelect>
        <div className="space-y-2 sm:col-span-2">
          <Label>Roles que pueden editar facturas emitidas</Label>
          <Controller
            control={form.control}
            name="roles_editan_factura"
            render={({ field }) => (
              <div className="flex flex-wrap gap-3">
                {ROLES.map((rol) => {
                  const marcado = field.value?.includes(rol) ?? false;
                  return (
                    <label key={rol} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Checkbox checked={marcado} onCheckedChange={(v) =>
                        field.onChange(v ? [...(field.value ?? []), rol] : (field.value ?? []).filter((r) => r !== rol))} />
                      {NOMBRE_ROL[rol]}
                    </label>
                  );
                })}
              </div>
            )}
          />
          {err.roles_editan_factura && <p className="text-xs text-destructive">{err.roles_editan_factura.message}</p>}
        </div>
        <Controller control={form.control} name="entregas_suman_inventario" render={({ field }) => (
          <Interruptor etiqueta="Las entregas de proveedores suman materia prima al inventario"
            ayuda="Cada entrega registra una entrada por compra con el peso neto (kg)." checked={field.value} onChange={field.onChange} />
        )} />
        <CampoSelect etiqueta="Ubicación donde entran las entregas" {...form.register("entregas_ubicacion_id", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}>
          <option value="">Ubicación predeterminada</option>
          {ubicaciones.map((u) => <option key={u.valor} value={u.valor}>{u.etiqueta}</option>)}
        </CampoSelect>
        <div />
        <Controller control={form.control} name="lotes_activos" render={({ field }) => (
          <Interruptor etiqueta="Control por lotes (FIFO)" ayuda="Cada producción crea un lote con su fecha; las salidas consumen primero el más viejo."
            checked={field.value} onChange={field.onChange} />
        )} />
        <CampoSelect etiqueta="Periodo de nómina" {...form.register("nomina_periodicidad")}>
          <option value="semanal">Semanal</option>
          <option value="quincenal">Quincenal</option>
          <option value="mensual">Mensual</option>
        </CampoSelect>
        <CampoSelect etiqueta="La semana de nómina empieza el" {...form.register("nomina_inicio_semana")}>
          {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </CampoSelect>
      </Seccion>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button type="submit" size="lg" disabled={guardando || !form.formState.isDirty} className="shadow-lg shadow-primary/20">
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
