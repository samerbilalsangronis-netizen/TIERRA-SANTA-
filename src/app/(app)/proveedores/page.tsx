import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/components/comunes/encabezado";
import { KpisProveedores } from "@/features/proveedores/kpis";
import { FiltrosProveedores } from "@/features/proveedores/filtros";
import { ListaProveedores } from "@/features/proveedores/lista";
import { BotonNuevoProveedor } from "@/features/proveedores/dialogo-proveedor";

export const metadata: Metadata = { title: "Proveedores" };

const t = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export default async function PaginaProveedores({ searchParams }: PageProps<"/proveedores">) {
  const perfil = await exigirPerfil("ver_dashboard");
  const sp = await searchParams;
  const filtros = {
    q: t(sp.q), moneda: t(sp.moneda), saldo: t(sp.saldo) === "1", rubro: t(sp.rubro),
    desde: t(sp.desde), hasta: t(sp.hasta), inactivos: t(sp.inactivos) === "1",
  };
  const supabase = await crearClienteServidor();
  const [{ data: proveedores, error }, { data: kpis }, { data: rubros }, { data: monedas }] = await Promise.all([
    supabase.rpc("buscar_proveedores", {
      p_q: filtros.q || undefined,
      p_moneda: filtros.moneda || undefined,
      p_con_saldo: filtros.saldo,
      p_producto: filtros.rubro ? Number(filtros.rubro) : undefined,
      p_desde: fecha(filtros.desde) ?? undefined,
      p_hasta: fecha(filtros.hasta) ?? undefined,
      p_incluir_inactivos: filtros.inactivos,
    }),
    supabase.rpc("kpis_proveedores"),
    supabase.from("productos").select("id, codigo, nombre").neq("tipo", "terminado").order("codigo"),
    supabase.from("monedas").select("codigo").eq("activa", true).order("orden"),
  ]);
  const puedeEditar = puede(perfil.rol, "gestionar_proveedores");

  return (
    <>
      <EncabezadoPagina icono={Truck} titulo="Proveedores" descripcion="Entregas de fruta, abonos, cestas y saldos por moneda."
        acciones={puedeEditar && <BotonNuevoProveedor monedas={(monedas ?? []).map((m) => m.codigo)} />} />
      <KpisProveedores kpis={(kpis ?? {}) as Record<string, number>} />
      <FiltrosProveedores inicial={filtros} rubros={rubros ?? []} monedas={(monedas ?? []).map((m) => m.codigo)} />
      {error ? (
        <p className="text-sm text-destructive">No se pudo cargar la lista: {error.message}</p>
      ) : (
        <ListaProveedores proveedores={proveedores ?? []} hayFiltros={Object.values(filtros).some(Boolean)} />
      )}
    </>
  );
}
