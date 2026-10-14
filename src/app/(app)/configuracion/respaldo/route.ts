import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";
import type { Database } from "@/lib/supabase/database.types";

type Tabla = keyof Database["public"]["Tables"];

// Orden pensado para leer el respaldo; una hoja por tabla.
const TABLAS: Tabla[] = [
  "empresa", "profiles", "monedas", "tasas_cambio", "unidades", "ubicaciones", "productos", "metodos_pago",
  "clientes", "facturas", "factura_lineas", "factura_versiones", "pagos_clientes", "pago_aplicaciones", "empaques_clientes",
  "proveedores", "entregas_proveedor", "abonos_proveedor", "cestas_proveedor",
  "lotes", "producciones", "movimientos_inventario", "existencias",
  "empleados", "tareas_nomina", "jornadas", "jornada_tareas", "abonos_empleados", "periodos_nomina", "periodo_nomina_items",
  "contadores", "audit_log",
];
const LOTE = 1000;

function celda(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return v as string | number | boolean;
}

/** Respaldo completo de la base en Excel (solo admin). */
export async function GET() {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok || !puede(perfil.rol, "configuracion")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const supabase = await crearClienteServidor();
  const libro = XLSX.utils.book_new();
  const resumen: (string | number)[][] = [["Tabla", "Registros"]];

  for (const tabla of TABLAS) {
    const filas: Record<string, unknown>[] = [];
    for (let desde = 0; ; desde += LOTE) {
      const { data, error } = await supabase.from(tabla).select("*").range(desde, desde + LOTE - 1);
      if (error) return NextResponse.json({ error: `${tabla}: ${error.message}` }, { status: 500 });
      filas.push(...(data as Record<string, unknown>[]));
      if (!data || data.length < LOTE) break;
    }
    const limpias = filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "search").map(([k, v]) => [k, celda(v)])));
    const hoja = limpias.length ? XLSX.utils.json_to_sheet(limpias) : XLSX.utils.aoa_to_sheet([["(sin registros)"]]);
    XLSX.utils.book_append_sheet(libro, hoja, tabla.slice(0, 31));
    resumen.push([tabla, filas.length]);
  }
  const hojaResumen = XLSX.utils.aoa_to_sheet([[`Respaldo Tierra Santa · ${hoyISO()}`], [], ...resumen]);
  XLSX.utils.book_append_sheet(libro, hojaResumen, "RESUMEN");
  libro.SheetNames.unshift(libro.SheetNames.pop()!);

  const archivo = XLSX.write(libro, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="respaldo-tierra-santa-${hoyISO()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
