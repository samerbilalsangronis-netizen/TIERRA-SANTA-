import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { hoyISO } from "@/lib/fechas";
import { cargarStock } from "@/features/inventario/datos";

/** Stock actual por producto y ubicación. */
export async function GET() {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { filas, ubicaciones } = await cargarStock();
  const ESTADO = { normal: "Normal", bajo: "Bajo", agotado: "Agotado" };
  const hoja = XLSX.utils.aoa_to_sheet([
    [`Inventario al ${hoyISO()}`], [],
    ["Código", "Producto", "Unidad", ...ubicaciones.map((u) => u.nombre), "Total", "Mínimo", "Estado"],
    ...filas.map((f) => [f.codigo, f.nombre, f.unidad, ...ubicaciones.map((u) => f.porUbicacion[u.id] ?? 0), f.total, f.stock_minimo, ESTADO[f.indicador]]),
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventario-${hoyISO()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
