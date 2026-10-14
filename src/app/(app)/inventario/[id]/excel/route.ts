import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaHora } from "@/lib/fechas";
import { TIPOS_MOVIMIENTO } from "@/features/inventario/datos";

const fecha = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function GET(request: NextRequest, { params }: RouteContext<"/inventario/[id]/excel">) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await params).id);
  const sp = request.nextUrl.searchParams;
  const ubic = sp.get("ubicacion");
  const supabase = await crearClienteServidor();
  const [{ data: producto }, { data, error }] = await Promise.all([
    supabase.from("productos").select("codigo, nombre, unidad").eq("id", id).maybeSingle(),
    supabase.rpc("kardex", { p_producto_id: id, p_desde: fecha(sp.get("desde")), p_hasta: fecha(sp.get("hasta")),
      p_ubicacion_id: ubic && /^\d+$/.test(ubic) ? Number(ubic) : undefined, p_forma: "PT" }),
  ]);
  if (error || !producto) return NextResponse.json({ error: error?.message ?? "Producto no encontrado" }, { status: 404 });
  const hoja = XLSX.utils.aoa_to_sheet([
    [`Kardex · ${producto.codigo} ${producto.nombre} (${producto.unidad})`], [],
    ["Fecha", "Movimiento", "Ubicación", "Referencia", "Nota", "Entra", "Sale", "Saldo", "Usuario"],
    ...(data ?? []).map((k) => [formatearFechaHora(k.fecha), TIPOS_MOVIMIENTO[k.tipo]?.texto ?? k.tipo, k.ubicacion, k.referencia ?? "", k.nota ?? "",
      k.entrada ? Number(k.entrada) : "", k.salida ? Number(k.salida) : "", Number(k.saldo), k.usuario ?? ""]),
  ]);
  hoja["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 26 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Kardex");
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kardex-${producto.codigo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
