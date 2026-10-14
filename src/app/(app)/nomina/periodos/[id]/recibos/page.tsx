import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirPerfil } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearCantidad, formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { EncabezadoHoja, Hoja } from "@/components/comunes/hoja";
import { BotonImprimir } from "@/features/proveedores/controles-estado-cuenta";
import { cargarPeriodo } from "@/features/nomina/datos-periodo";

export const metadata: Metadata = { title: "Recibos de nómina" };
const cop = (v: number) => formatearMonto(v, "COP");

/** Un recibo por empleado (cada uno en su página al imprimir). ?empleado=ID imprime solo uno. */
export default async function PaginaRecibos({ params, searchParams }: PageProps<"/nomina/periodos/[id]/recibos">) {
  await exigirPerfil("nomina");
  const id = Number((await params).id);
  const solo = Number((await searchParams).empleado) || null;
  const supabase = await crearClienteServidor();
  const [datos, { data: empresa }] = await Promise.all([
    cargarPeriodo(id),
    supabase.from("empresa").select("razon_social, rif, direccion, telefonos, logo_path").eq("id", 1).single(),
  ]);
  if (!datos) notFound();
  const { periodo, filas } = datos;
  const lista = filas.filter((f) => !solo || f.empleado_id === solo);

  return (
    <>
      <div className="no-print mb-4 flex items-center gap-2">
        <Link href={`/nomina/periodos/${id}`} className="mr-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Periodo</Link>
        <BotonImprimir />
      </div>
      {periodo.estado === "abierto" && <p className="no-print mb-3 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">El periodo está abierto: los montos pueden cambiar hasta que se cierre.</p>}
      <div className="space-y-6">
        {lista.map((f) => (
          <div key={f.empleado_id} className="break-after-page">
            <Hoja>
              <EncabezadoHoja empresa={empresa} titulo="RECIBO DE NÓMINA" lineas={[`Periodo: ${formatearFecha(periodo.desde)} – ${formatearFecha(periodo.hasta)}`, "Moneda: COP"]} />
              <p className="border-b border-neutral-300 py-3"><span className="text-neutral-500">Empleado:</span> <b>{f.nombre}</b> <span className="text-neutral-500">({f.tipo === "fijo" ? "fijo" : "por tarea"})</span></p>
              <table className="mt-3 w-full border-collapse">
                <tbody>
                  <tr><td className="py-1">Días asistidos</td><td className="tabular py-1 text-right">{f.dias_asistidos}{f.medias ? ` + ${f.medias} medias jornadas` : ""}{f.faltas ? ` · ${f.faltas} faltas` : ""}</td></tr>
                  <tr><td className="py-1">Pago por días y adicionales</td><td className="tabular py-1 text-right">{cop(f.total_dias)}</td></tr>
                  {(f.detalle ?? []).map((d) => (
                    <tr key={d.tarea}><td className="py-1 pl-4 text-neutral-600">{d.tarea} × {formatearCantidad(d.cantidad)} {d.unidad}</td><td className="tabular py-1 text-right">{cop(d.monto)}</td></tr>
                  ))}
                  <tr className="border-t border-neutral-300 font-semibold"><td className="py-1.5">Ganado en el periodo</td><td className="tabular py-1.5 text-right">{cop(f.ganado)}</td></tr>
                  {f.saldo_anterior !== 0 && <tr><td className="py-1">Saldo anterior</td><td className="tabular py-1 text-right">{cop(f.saldo_anterior)}</td></tr>}
                  {f.abonos > 0 && <tr><td className="py-1">Abonos / adelantos recibidos</td><td className="tabular py-1 text-right">− {cop(f.abonos)}</td></tr>}
                  <tr className="border-t-2 border-neutral-800 text-base font-bold"><td className="py-2">TOTAL A PAGAR</td><td className="tabular py-2 text-right">{cop(f.neto)}</td></tr>
                </tbody>
              </table>
              <div className="mt-14 grid grid-cols-2 gap-8 text-center text-xs text-neutral-600">
                <div className="border-t border-neutral-500 pt-1">Entregado por</div>
                <div className="border-t border-neutral-500 pt-1">Recibí conforme: {f.nombre}</div>
              </div>
            </Hoja>
          </div>
        ))}
        {lista.length === 0 && <p className="text-center text-sm text-muted-foreground">Sin recibos en este periodo.</p>}
      </div>
    </>
  );
}
