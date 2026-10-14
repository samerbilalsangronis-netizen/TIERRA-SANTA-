import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, History, KeyRound, ShieldCheck, Users } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { NOMBRE_ROL, puede } from "@/lib/auth/roles";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Configuración" };

const SECCIONES = [
  { href: "/configuracion/empresa", titulo: "Empresa", texto: "Razón social, logo, IVA, numeración y comportamiento.", icono: Building2 },
  { href: "/configuracion/usuarios", titulo: "Usuarios", texto: "Crear, bloquear, vencimientos y contraseñas.", icono: Users },
  { href: "/configuracion/catalogos", titulo: "Catálogos", texto: "Productos, unidades, ubicaciones, monedas, métodos de pago y tareas.", icono: BookOpen },
  { href: "/configuracion/auditoria", titulo: "Auditoría", texto: "Quién creó, editó, anuló o borró qué y cuándo.", icono: History },
];

export default async function PaginaConfiguracion() {
  const perfil = await exigirPerfil();
  const esAdmin = puede(perfil.rol, "configuracion");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Mi cuenta</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Usuario</dt><dd className="font-medium">{perfil.usuario}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Nombre</dt><dd>{perfil.nombre || "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Rol</dt><dd>{NOMBRE_ROL[perfil.rol]}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Vence</dt><dd>{perfil.vence_el ? formatearFecha(perfil.vence_el) : "Sin vencimiento"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Último acceso</dt><dd>{formatearFechaHora(perfil.ultimo_acceso)}</dd></div>
        </dl>
        <Link href="/auth/cambiar-clave" className={buttonVariants({ variant: "outline", className: "mt-4 w-full" })}>
          <KeyRound className="size-4" /> Cambiar contraseña
        </Link>
      </section>
      {esAdmin && (
        <section className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {SECCIONES.map((s) => (
            <Link key={s.href} href={s.href} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
              <s.icono className="size-5 text-primary" />
              <p className="mt-3 font-semibold group-hover:text-primary">{s.titulo}</p>
              <p className="text-sm text-muted-foreground">{s.texto}</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
