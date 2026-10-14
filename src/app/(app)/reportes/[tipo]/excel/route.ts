import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { hoyISO } from "@/lib/fechas";
import { esTipoReporte, generarReporte } from "@/features/reportes/definiciones";

const fecha = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(request: NextRequest, { params }: RouteContext<"/reportes/[tipo]/excel">) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const tipo = (await params).tipo;
  if (!esTipoReporte(tipo)) return NextResponse.json({ error: "Reporte no existe" }, { status: 404 });
  const sp = request.nextUrl.searchParams;
  const hasta = fecha(sp.get("hasta")) ?? hoyISO();
  const desde = fecha(sp.get("desde")) ?? `${hasta.slice(0, 8)}01`;
  const r = await generarReporte(tipo, { desde, hasta, moneda: sp.get("moneda") || "USD" });
  const hoja = XLSX.utils.aoa_to_sheet([
    [`${r.titulo} · ${desde} a ${hasta}${r.moneda ? ` · ${r.moneda}` : ""}`], [],
    r.columnas.map((c) => c.titulo),
    ...r.filas,
    ...(r.totales && r.filas.length ? [r.totales.map((v) => v ?? "")] : []),
    ...(r.nota ? [[], [r.nota]] : []),
  ]);
  hoja["!cols"] = r.columnas.map((c) => ({ wch: c.tipo === "texto" ? 28 : 13 }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, r.titulo.slice(0, 31));
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${tipo}-${desde}-a-${hasta}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
