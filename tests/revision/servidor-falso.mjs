// Datos sintéticos. No conecta con Supabase ni escribe archivos o datos comerciales.
import { createServer } from "node:http";
const perfil = { id: "00000000-0000-4000-8000-000000000001", nombre: "Revisión", email: "revision@tierrasanta.test", rol: "admin", estado: "ACTIVO", debe_cambiar_clave: false };
const proveedor = { id: 1, nombre: "Proveedor de prueba", documento: "", telefono: "", ubicacion: "", moneda_habitual: "COP", tipo: "fruta", activo: true, notas: null };
const empleado = { id: 1, nombre: "Empleado de prueba", tipo: "fijo", tarifa_dia: 100, activo: true, saldo_neto: 50, ultima_jornada: "2026-11-01" };
const entregas = Array.from({ length: 1205 }, (_, i) => ({ id: i + 1, proveedor_id: 1, fecha: "2026-11-01", producto_id: 1, moneda: "COP", modo_pesaje: "KG", kg_por_cesta: 1, cestas: 0, kg_total: 1, unidades: 0, precio: 1, merma: 0, precio_kg: 1, desc_merma: 0, total: 1, peso_neto: 1, foto_url: null, foto_path: null, nota: `Entrega ${i + 1}`, productos: { codigo: 901, nombre: "Mora", emoji: null, unidad: "kg", categoria: "fruta" } }));
const pagos = Array.from({ length: 605 }, (_, i) => ({ id: i + 1, empleado_id: 1, fecha: i ? "2026-11-01" : "2025-01-01", monto: 1, tipo: i ? "adelanto" : "liquidacion", entregado_por: null, nota: `Pago ${i + 1}`, periodo_id: null }));
const gastos = Array.from({ length: 2205 }, (_, i) => ({ id: i + 1, fecha: "2026-11-01", concepto_id: 1, moneda: "COP", monto: 1, cantidad: 1, unidad: "und", metodo_id: null, lugar: null, pagado_por: null, nota: `Gasto ${i + 1}`, foto_path: null, conceptos_gasto: { nombre: "Guantes", categoria_id: 1, categorias_gasto: { nombre: "Higiene" } }, metodos_pago: null }));
const tablas = {
  profiles: [perfil], proveedores: [proveedor], entregas_proveedor: entregas,
  v_resumen_proveedores: [{ ...proveedor, cestas_pendientes: 0, cestas_entregadas: 0, cestas_devueltas: 0 }],
  v_saldos_proveedores_moneda: [{ proveedor_id: 1, moneda: "COP", saldo: 1205 }],
  abonos_proveedor: Array.from({ length: 105 }, (_, i) => ({ id: i + 1, proveedor_id: 1, numero: i + 1, fecha: "2026-11-01", moneda: "COP", monto: 1, metodo_id: null, referencia: null, pagado_por: null, nota: `Abono ${i + 1}`, metodos_pago: null })),
  cestas_proveedor: [], productos: [], monedas: [{ codigo: "COP", activa: true, orden: 1 }], metodos_pago: [],
  empresa: [{ id: 1, razon_social: "Revisión de historiales", moneda_defecto: "COP", nomina_inicio_semana: 1 }],
  empleados: [empleado], v_resumen_empleados: [empleado], tareas_nomina: [], jornadas: [], periodos_nomina: [], abonos_empleados: pagos,
  gastos, categorias_gasto: [{ id: 1, nombre: "Higiene", activa: true }], conceptos_gasto: [{ id: 1, nombre: "Guantes", categoria_id: 1, unidad: "und", activo: true }], unidades: [{ codigo: "und", nombre: "Unidad", activa: true }],
};
createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1:54321");
  res.setHeader("Content-Type", "application/json");
  if (u.pathname === "/auth/v1/user") return res.end(JSON.stringify({ ...perfil, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} }));
  let filas = [...(tablas[u.pathname.split("/").at(-1)] ?? [])];
  for (const [campo, expresion] of u.searchParams) {
    if (["select", "order", "offset", "limit"].includes(campo)) continue;
    const [op, ...trozos] = expresion.split("."); const valor = trozos.join(".");
    if (!["eq", "gte", "lte"].includes(op)) continue;
    filas = filas.filter((f) => {
      const v = campo.split(".").reduce((a, k) => a?.[k], f);
      return op === "eq" ? String(v) === valor : op === "gte" ? String(v) >= valor : String(v) <= valor;
    });
  }
  const orden = u.searchParams.get("order");
  if (orden) filas.sort((a, b) => {
    for (const parte of orden.split(",")) {
      const [k, dir] = parte.split("."); const diferencia = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
      if (diferencia) return dir === "desc" ? -diferencia : diferencia;
    }
    return 0;
  });
  const desde = Number(u.searchParams.get("offset") ?? 0);
  const limite = Math.min(Number(u.searchParams.get("limit") ?? 1000), 17);
  const pagina = filas.slice(desde, desde + limite);
  res.setHeader("Content-Range", `${desde}-${desde + pagina.length - 1}/${filas.length}`);
  const objeto = req.headers.accept?.includes("application/vnd.pgrst.object");
  res.end(JSON.stringify(objeto ? pagina[0] ?? null : pagina));
}).listen(54321, "127.0.0.1", () => process.stdout.write("Servidor de datos sintéticos en 54321\n"));
