"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoSelect, CampoTexto } from "@/components/comunes/campos";
import { ESTADOS_USUARIO, NOMBRE_ROL, ROLES } from "@/lib/auth/roles";
import { crearUsuario, editarUsuario, restablecerClave } from "./acciones";
import {
  esquemaEditarUsuario, esquemaNuevoUsuario, esquemaRestablecer,
  type DatosEditarUsuario, type DatosNuevoUsuario, type DatosRestablecer,
} from "./esquemas";
import type { FilaUsuario } from "./panel-usuarios";

/** Genera una contraseña temporal legible (letras y números). */
function claveTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  const base = Array.from(arr.slice(0, 6), (n) => letras[n % letras.length]).join("");
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${(arr[6] % 90) + 10}`;
}

export function DialogoUsuario({ abierto, usuario, esYo, onCerrar }: { abierto: boolean; usuario?: FilaUsuario; esYo?: boolean; onCerrar: () => void }) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{usuario ? `Editar @${usuario.usuario}` : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {usuario ? "Cambia rol, estado, vencimiento o datos de contacto." : "El usuario inicia sesión con su nombre de usuario (el correo es opcional)."}
          </DialogDescription>
        </DialogHeader>
        {abierto && (usuario ? <FormEditar usuario={usuario} esYo={!!esYo} onListo={onCerrar} /> : <FormNuevo onListo={onCerrar} />)}
      </DialogContent>
    </Dialog>
  );
}

function FormNuevo({ onListo }: { onListo: () => void }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const form = useForm<DatosNuevoUsuario, unknown, z.output<typeof esquemaNuevoUsuario>>({
    resolver: zodResolver(esquemaNuevoUsuario),
    defaultValues: { usuario: "", nombre: "", correo: "", rol: "facturacion", vence_el: "", clave: "", debe_cambiar_clave: true },
  });
  useEffect(() => form.setValue("clave", claveTemporal()), [form]);
  const err = form.formState.errors;
  const enviar = form.handleSubmit(() =>
    iniciar(async () => {
      const d = form.getValues();
      const r = await crearUsuario(d);
      if (!r.ok) {
        toast.error(r.error);
        Object.entries(r.campos ?? {}).forEach(([k, m]) => form.setError(k as keyof DatosNuevoUsuario, { message: m }));
        return;
      }
      toast.success(r.mensaje, { description: `Contraseña temporal: ${d.clave}`, duration: 15000 });
      router.refresh();
      onListo();
    }),
  );
  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2" noValidate>
      <CampoTexto etiqueta="Usuario" requerido autoCapitalize="none" placeholder="maria.p" error={err.usuario?.message} {...form.register("usuario")} />
      <CampoTexto etiqueta="Nombre" requerido error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Correo (opcional)" type="email" className="sm:col-span-2" error={err.correo?.message} {...form.register("correo")} />
      <CampoSelect etiqueta="Rol" {...form.register("rol")}>
        {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Vence el" type="date" ayuda="Vacío = sin vencimiento" error={err.vence_el?.message} {...form.register("vence_el")} />
      <CampoTexto etiqueta="Contraseña inicial" className="sm:col-span-2" autoComplete="off" error={err.clave?.message}
        ayuda="Se muestra al crear; compártela con el usuario." {...form.register("clave")} />
      <Controller control={form.control} name="debe_cambiar_clave" render={({ field }) => (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          Exigir cambio de contraseña en el primer inicio
        </label>
      )} />
      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="outline" onClick={onListo}>Cancelar</Button>
        <Button type="submit" disabled={pendiente}>{pendiente && <Loader2 className="size-4 animate-spin" />} Crear usuario</Button>
      </DialogFooter>
    </form>
  );
}

function FormEditar({ usuario, esYo, onListo }: { usuario: FilaUsuario; esYo: boolean; onListo: () => void }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const form = useForm<DatosEditarUsuario, unknown, z.output<typeof esquemaEditarUsuario>>({
    resolver: zodResolver(esquemaEditarUsuario),
    defaultValues: {
      id: usuario.id, nombre: usuario.nombre, correo: usuario.email ?? "", rol: usuario.rol,
      estado: usuario.estado, vence_el: usuario.vence_el ?? "",
    },
  });
  const err = form.formState.errors;
  const enviar = form.handleSubmit(() =>
    iniciar(async () => {
      const r = await editarUsuario(form.getValues());
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje);
      router.refresh();
      onListo();
    }),
  );
  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2" noValidate>
      <CampoTexto etiqueta="Nombre" requerido className="sm:col-span-2" error={err.nombre?.message} {...form.register("nombre")} />
      <CampoTexto etiqueta="Correo (opcional)" type="email" className="sm:col-span-2" error={err.correo?.message}
        ayuda="Si se deja vacío, el usuario entra solo con su nombre de usuario." {...form.register("correo")} />
      <CampoSelect etiqueta="Rol" disabled={esYo} {...form.register("rol")}>
        {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Estado" disabled={esYo} {...form.register("estado")}>
        {ESTADOS_USUARIO.map((e) => <option key={e} value={e}>{e}</option>)}
      </CampoSelect>
      <CampoTexto etiqueta="Vence el" type="date" className="sm:col-span-2" ayuda="Vacío = sin vencimiento. Al vencer, el usuario queda BLOQUEADO."
        error={err.vence_el?.message} {...form.register("vence_el")} />
      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="outline" onClick={onListo}>Cancelar</Button>
        <Button type="submit" disabled={pendiente}>{pendiente && <Loader2 className="size-4 animate-spin" />} Guardar</Button>
      </DialogFooter>
    </form>
  );
}

export function DialogoRestablecer({ usuario, onCerrar }: { usuario: FilaUsuario | null; onCerrar: () => void }) {
  const [pendiente, iniciar] = useTransition();
  const form = useForm<DatosRestablecer>({
    resolver: zodResolver(esquemaRestablecer),
    defaultValues: { id: "", clave: "", debe_cambiar_clave: true },
  });
  useEffect(() => {
    if (usuario) form.reset({ id: usuario.id, clave: claveTemporal(), debe_cambiar_clave: true });
  }, [usuario, form]);
  const enviar = form.handleSubmit((d) =>
    iniciar(async () => {
      const r = await restablecerClave(d);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje, { description: `Nueva contraseña: ${d.clave}`, duration: 15000 });
      onCerrar();
    }),
  );
  return (
    <Dialog open={!!usuario} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>Usuario @{usuario?.usuario}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-3" noValidate>
          <CampoTexto etiqueta="Nueva contraseña" autoComplete="off" error={form.formState.errors.clave?.message} {...form.register("clave")} />
          <Controller control={form.control} name="debe_cambiar_clave" render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
              Exigir cambio en el próximo inicio
            </label>
          )} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" disabled={pendiente}>{pendiente && <Loader2 className="size-4 animate-spin" />} Restablecer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
