import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { obtenerEstadoCuenta } from "@/features/proveedores/estado-cuenta";
import { hoyISO } from "@/lib/fechas";

export async function GET(request: NextRequest, ctx: RouteContext<"/proveedores/[id]/estado-cuenta/excel">) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await ctx.params).id);
  const sp = request.nextUrl.searchParams;
  const datos = await obtenerEstadoCuenta(id, sp.get("moneda"), sp.get("desde"), sp.get("hasta"));
  if (!datos) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  const { proveedor, moneda, desde, hasta, filas, totales } = datos;

  const aoa: (string | number | null)[][] = [
    [`Estado de cuenta · ${proveedor.nombre}`],
    [`Moneda: ${moneda}`, `Desde: ${desde ?? "inicio"}`, `Hasta: ${hasta ?? hoyISO()}`],
    [],
    ["Fecha", "Tipo", "Detalle", "Cestas", "Kg", "Merma (kg)", `Entregas (${moneda})`, `Abonos (${moneda})`, `Saldo (${moneda})`],
    ...filas.map((f) => [
      f.fecha, f.tipo === "saldo_anterior" ? "Saldo anterior" : f.tipo === "entrega" ? "Entrega" : "Abono", f.detalle,
      f.cestas === null ? null : Number(f.cestas), f.kg === null ? null : Number(f.kg), f.merma === null ? null : Number(f.merma),
      f.cargo === null ? null : Number(f.cargo), f.abono === null ? null : Number(f.abono), Number(f.saldo),
    ]),
    [],
    ["Totales", "", "", "", totales.kg, totales.merma, totales.cargos, totales.abonos, totales.saldoFinal],
  ];
  const hoja = XLSX.utils.aoa_to_sheet(aoa);
  hoja["!cols"] = [{ wch: 11 }, { wch: 14 }, { wch: 48 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Estado de cuenta");
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const nombre = proveedor.nombre.normalize("NFD").replace(/[^\w]+/g, "-").replace(/-+$/, "").toLowerCase();
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="estado-cuenta-${nombre}-${moneda}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
