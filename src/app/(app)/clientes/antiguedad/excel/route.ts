import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";

export async function GET(request: NextRequest) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const moneda = sp.get("moneda") || "USD";
  const corte = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("hasta") ?? "") ? sp.get("hasta")! : hoyISO();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("antiguedad_cxc", { p_corte: corte, p_moneda: moneda });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const hoja = XLSX.utils.aoa_to_sheet([
    [`Antigüedad de saldos (${moneda}) al ${corte}`], [],
    ["Nº", "Cliente", "0–15 días", "16–30 días", "31–60 días", "+60 días", "Total"],
    ...(data ?? []).map((f) => [f.numero, f.nombre, Number(f.d0_15 ?? 0), Number(f.d16_30 ?? 0), Number(f.d31_60 ?? 0), Number(f.d60_mas ?? 0), Number(f.total ?? 0)]),
  ]);
  hoja["!cols"] = [{ wch: 6 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Antigüedad");
  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="antiguedad-${moneda}-${corte}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
