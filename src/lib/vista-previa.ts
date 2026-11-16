/** Protección del despliegue de revisión: deja consultar y autenticar, pero no operar. */
export const vistaPreviaSoloLectura = process.env.NEXT_PUBLIC_VISTA_PREVIA_LECTURA === "1";
const RPC_LECTURA = new Set([
  "empresa_publica", "antiguedad_cxc", "buscar_clientes", "buscar_facturas", "buscar_proveedores",
  "kpis_clientes", "kpis_proveedores", "resumen_periodo", "gastos_resumen", "ventas_por_cliente",
  "ventas_por_dia", "ventas_por_producto", "ventas_semanales", "ventas_cliente_por_producto",
  "totales_facturas", "puede_editar_facturas", "ultimos_precios_cliente", "kardex", "produccion_resumen",
  "pulpa_por_fruta", "estado_cuenta_cliente", "estado_cuenta_proveedor", "nomina_resumen",
  "cajas_cestas", "compras_por_proveedor", "fruta_recibida",
]);
export function permitePeticionVistaPrevia(url: string, metodo: string): boolean {
  const ruta = new URL(url).pathname;
  const rpc = ruta.match(/^\/rest\/v1\/rpc\/([^/]+)$/);
  if (rpc) return ["GET", "HEAD", "POST"].includes(metodo) && RPC_LECTURA.has(rpc[1]);
  if (["GET", "HEAD"].includes(metodo)) return true;
  if (metodo === "POST" && /^\/auth\/v1\/(token|logout)$/.test(ruta)) return true;
  return metodo === "POST" && /^\/storage\/v1\/object\/(sign|list)\//.test(ruta);
}
export const fetchVistaPrevia: typeof fetch = async (entrada, opciones) => {
  if (vistaPreviaSoloLectura) {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    const metodo = (opciones?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
    if (!permitePeticionVistaPrevia(url, metodo)) {
      return new Response(JSON.stringify({ message: "Vista previa de solo consulta: no se guardaron cambios.", code: "42501" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      });
    }
  }
  return fetch(entrada, opciones);
};
