import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { obtenerEstadoCuentaCliente } from "@/features/clientes/estado-cuenta";
import { hoyISO } from "@/lib/fechas";

export async function GET(request: NextRequest, ctx: RouteContext<"/clientes/[id]/estado-cuenta/excel">) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await ctx.params).id);
  const sp = request.nextUrl.searchParams;
  const datos = await obtenerEstadoCuentaCliente(id, sp.get("moneda"), sp.get("desde"), sp.get("hasta"));
  if (!datos) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const { cliente, moneda, desde, hasta, filas, totales } = datos;
  const hoja = XLSX.utils.aoa_to_sheet([
    [`Estado de cuenta · ${cliente.nombre} (cliente nº ${cliente.numero})`],
    [`Moneda: ${moneda}`, `Desde: ${desde ?? "inicio"}`, `Hasta: ${hasta ?? hoyISO()}`],
    [],
    ["Fecha", "Documento", "Detalle", `Cargos (${moneda})`, `Abonos (${moneda})`, `Saldo (${moneda})`],
    ...filas.map((f) => [f.fecha, f.documento, f.detalle, f.cargo === null ? null : Number(f.cargo), f.abono === null ? null : Number(f.abono), Number(f.saldo)]),
    [],
    ["Totales", "", "", totales.cargos, totales.abonos, totales.saldoFinal],
  ]);
  hoja["!cols"] = [{ wch: 11 }, { wch: 14 }, { wch: 46 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Estado de cuenta");
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="estado-cuenta-cliente-${cliente.numero}-${moneda}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
