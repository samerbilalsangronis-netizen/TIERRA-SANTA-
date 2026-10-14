import type { Metadata } from "next";
import { History } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Paginacion } from "@/components/comunes/paginacion";
import { FiltrosAuditoria } from "@/features/auditoria/filtros";
import { ListaAuditoria } from "@/features/auditoria/lista";

export const metadata: Metadata = { title: "Auditoría" };

const POR_PAGINA = 50;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function PaginaAuditoria({ searchParams }: PageProps<"/configuracion/auditoria">) {
  await exigirPerfil("auditoria");
  const sp = await searchParams;
  const pagina = Math.max(1, Number(texto(sp.pagina)) || 1);
  const filtros = {
    tabla: texto(sp.tabla), accion: texto(sp.accion), usuario: texto(sp.usuario),
    desde: texto(sp.desde), hasta: texto(sp.hasta), registro: texto(sp.registro),
  };

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("audit_log")
    .select("id, ocurrido_el, usuario, accion, tabla, registro_id, antes, despues, nota", { count: "exact" })
    .order("ocurrido_el", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (filtros.tabla) consulta = consulta.eq("tabla", filtros.tabla);
  if (filtros.accion) consulta = consulta.eq("accion", filtros.accion);
  if (filtros.usuario) consulta = consulta.ilike("usuario", `%${filtros.usuario}%`);
  if (filtros.registro) consulta = consulta.eq("registro_id", filtros.registro);
  if (/^\d{4}-\d{2}-\d{2}$/.test(filtros.desde)) consulta = consulta.gte("ocurrido_el", `${filtros.desde}T00:00:00-04:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(filtros.hasta)) consulta = consulta.lte("ocurrido_el", `${filtros.hasta}T23:59:59.999-04:00`);
  const { data, count, error } = await consulta;

  return (
    <div className="space-y-4">
      <FiltrosAuditoria inicial={filtros} />
      {error ? (
        <p className="text-sm text-destructive">No se pudo cargar la bitácora: {error.message}</p>
      ) : !data?.length ? (
        <EstadoVacio icono={History} titulo="Sin registros" descripcion="No hay movimientos con estos filtros." />
      ) : (
        <>
          <ListaAuditoria filas={data} />
          <Paginacion pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} />
        </>
      )}
    </div>
  );
}
