import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { cargarPeriodo } from "@/features/nomina/datos-periodo";
import { nombreTipo, separarPorTipo } from "@/features/nomina/tipos";

export async function GET(_: Request, { params }: RouteContext<"/nomina/periodos/[id]/excel">) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok || !puede(perfil.rol, "nomina")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const datos = await cargarPeriodo(Number((await params).id));
  if (!datos) return NextResponse.json({ error: "Periodo no encontrado" }, { status: 404 });
  const { periodo, filas } = datos;
  const hoja = XLSX.utils.aoa_to_sheet([
    [`Nómina ${periodo.desde} a ${periodo.hasta} (${periodo.estado}) · COP`], [],
    ["Empleado", "Tipo", "Días", "Medias", "Faltas", "Por días", "Por tareas", "Ganado", "Abonos", "Saldo anterior", "A pagar"],
    ...separarPorTipo(filas).flatMap((g) => g.filas).map((f) => [f.nombre, nombreTipo(f.tipo), f.dias_asistidos, f.medias, f.faltas, f.total_dias, f.total_tareas, f.ganado, f.abonos, f.saldo_anterior, f.neto]),
  ]);
  hoja["!cols"] = [{ wch: 28 }, { wch: 9 }, { wch: 6 }, { wch: 7 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Nómina");
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nomina-${periodo.desde}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
