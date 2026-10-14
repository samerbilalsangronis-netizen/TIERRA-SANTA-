import type { Metadata } from "next";
import Link from "next/link";
import { Hourglass, Users } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { KpisClientes } from "@/features/clientes/kpis";
import { FiltrosClientes } from "@/features/clientes/filtros";
import { ListaClientes } from "@/features/clientes/lista";
import { BotonNuevoCliente } from "@/features/clientes/dialogo-cliente";

export const metadata: Metadata = { title: "Clientes" };
const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const sp = await searchParams;
  const filtros = { q: t(sp.q), estado: t(sp.estado), moneda: t(sp.moneda), inactivos: t(sp.inactivos) === "1" };
  const supabase = await crearClienteServidor();
  const [{ data: clientes, error }, { data: kpis }] = await Promise.all([
    supabase.rpc("buscar_clientes", {
      p_q: filtros.q || undefined,
      p_estado: ["CRÍTICO", "AL DÍA"].includes(filtros.estado) ? filtros.estado : undefined,
      p_moneda: filtros.moneda || undefined,
      p_incluir_inactivos: filtros.inactivos,
    }),
    supabase.rpc("kpis_clientes"),
  ]);
  return (
    <>
      <EncabezadoPagina icono={Users} titulo="Clientes" descripcion="Facturas, pagos por factura, empaques y saldos por moneda."
        acciones={
          <>
            <Link href="/clientes/antiguedad" className={buttonVariants({ variant: "outline" })}><Hourglass className="size-4" /> Antigüedad de saldos</Link>
            {puede(perfil.rol, "gestionar_clientes") && <BotonNuevoCliente esAdmin={perfil.rol === "admin"} />}
          </>
        } />
      <KpisClientes kpis={(kpis ?? {}) as Record<string, number>} />
      <FiltrosClientes inicial={filtros} />
      {error ? <p className="text-sm text-destructive">No se pudo cargar la lista: {error.message}</p>
        : <ListaClientes clientes={clientes ?? []} hayFiltros={Boolean(filtros.q || filtros.estado || filtros.moneda || filtros.inactivos)} />}
    </>
  );
}
