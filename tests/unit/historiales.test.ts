import { beforeEach, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@supabase/supabase-js";
import { resumirEntregas } from "@/features/proveedores/resumen";
import { leerTodos } from "@/lib/paginacion";

const estado = vi.hoisted(() => ({ cliente: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ crearClienteServidor: async () => estado.cliente }));
import { cargarGastos, cargarResumenGastos } from "@/features/gastos/datos";
import { cargarAbonosEmpleado, cargarUltimosPagos } from "@/features/nomina/datos";
import { obtenerEstadoCuenta } from "@/features/proveedores/estado-cuenta";

const gastos = Array.from({ length: 2205 }, (_, i) => ({
  id: i + 1, fecha: "2026-11-01", concepto_id: 1, monto: 0.1, moneda: "COP", cantidad: 1,
  unidad: "und", metodo_id: null, lugar: null, pagado_por: null, nota: null, foto_path: null,
  conceptos_gasto: { nombre: "Guantes", categoria_id: 1, categorias_gasto: { nombre: "Higiene" } }, metodos_pago: null,
}));
const pagos = Array.from({ length: 605 }, (_, i) => ({
  id: i + 1, empleado_id: 1, fecha: i === 0 ? "2025-01-01" : "2026-11-01", monto: 100,
  tipo: i === 0 ? "liquidacion" : "adelanto", entregado_por: null, nota: null, periodo_id: null,
}));
const entregas = Array.from({ length: 1205 }, (_, i) => ({
  id: i + 1, fecha: "2026-11-01", moneda: "COP", total: 0.1, kg_total: 1, merma: 0, peso_neto: 1, cestas: 0,
  modo_pesaje: "KG", precio: 0.1, precio_kg: 0.1, unidades: 0, kg_por_cesta: 0, nota: null, productos: { nombre: "Mora", emoji: null },
}));
const movimientos = [
  { fecha: "2026-11-01", tipo: "saldo_anterior", ref_id: null, detalle: "Saldo anterior", saldo: 50, cargo: null, abono: null, kg: null, cestas: null, merma: null },
  ...entregas.map((e, i) => ({ fecha: "2026-11-01", tipo: "entrega", ref_id: e.id, detalle: "Mora", saldo: 50 + (i + 1) / 10, cargo: 0.1, abono: 0, kg: 1, cestas: 0, merma: 0 })),
];
const peticiones: URL[] = [];
beforeEach(() => {
  peticiones.length = 0;
  estado.cliente = createClient<Database>("https://prueba.supabase.co", "clave-de-prueba", {
    auth: { persistSession: false },
    global: { fetch: async (input) => {
      const u = new URL(String(input)); peticiones.push(u);
      const nombre = u.pathname.split("/").at(-1);
      if (["proveedores", "empresa"].includes(nombre!)) return new Response(JSON.stringify(nombre === "proveedores"
        ? { id: 1, nombre: "Proveedor ficticio", moneda_habitual: "COP" } : { razon_social: "Prueba" }), { status: 200 });
      let filas: Record<string, unknown>[] = nombre === "gastos" ? [...gastos] : nombre === "abonos_empleados" ? [...pagos]
        : nombre === "entregas_proveedor" ? [...entregas] : nombre === "estado_cuenta_proveedor" ? [...movimientos] : [];
      const tipo = u.searchParams.get("tipo");
      if (tipo?.startsWith("eq.")) filas = filas.filter((x) => x.tipo === tipo.slice(3));
      for (const v of u.searchParams.getAll("fecha")) {
        if (v.startsWith("gte.")) filas = filas.filter((x) => String(x.fecha) >= v.slice(4));
        if (v.startsWith("lte.")) filas = filas.filter((x) => String(x.fecha) <= v.slice(4));
      }
      const orden = u.searchParams.get("order") ?? "";
      if (orden.includes("id.desc")) filas.reverse();
      const desde = Number(u.searchParams.get("offset") ?? 0);
      const limite = Math.min(Number(u.searchParams.get("limit") ?? 1000), 17);
      const pagina = filas.slice(desde, desde + limite);
      return new Response(JSON.stringify(pagina), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": `${desde}-${desde + pagina.length - 1}/${filas.length}` } });
    } },
  });
});

it("gastos: página de 50 y resumen completo de 2.205 con filtro, sin firmar fotos fuera de página", async () => {
  const f = { desde: "2026-11-01", hasta: "2026-11-30", categoriaId: 1, conceptoId: 1 };
  const pagina = await cargarGastos(f, 45);
  const resumen = await cargarResumenGastos(f);
  expect(pagina.total).toBe(2205);
  expect(pagina.filas).toHaveLength(5);
  expect(resumen).toHaveLength(2205);
  expect(peticiones.every((u) => u.searchParams.get("conceptos_gasto.categoria_id") === "eq.1")).toBe(true);
});
it("nómina: el último pago y los pagos del reporte sobreviven a 605 movimientos", async () => {
  expect((await cargarUltimosPagos(1)).get(1)).toEqual({ fecha: "2025-01-01", monto: 100 });
  const antiguos = await cargarAbonosEmpleado(1, "2025-01-01", "2025-01-31");
  expect(antiguos).toHaveLength(1);
  expect(antiguos[0].id).toBe(1);
});
it("proveedores: total completo por moneda con precisión decimal", async () => {
  const filas = await leerTodos((d, h) => (estado.cliente as ReturnType<typeof createClient<Database>>).from("entregas_proveedor").select("*", { count: "exact" }).order("id").range(d, h));
  expect(resumirEntregas(filas)[0]).toEqual(["COP", { total: 120.5, kg: 1205, merma: 0, neto: 1205, cestas: 0, n: 1205 }]);
});
it("estado de cuenta: conserva saldo anterior, 1.205 entregas, saldo final y todos los detalles", async () => {
  const r = await obtenerEstadoCuenta(1, "COP", "2026-11-01", "2026-11-30");
  expect(r?.filas).toHaveLength(1206);
  expect(r?.filas[0].tipo).toBe("saldo_anterior");
  expect(r?.detalles.size).toBe(1205);
  expect(r?.totales.saldoFinal).toBe(170.5);
});
