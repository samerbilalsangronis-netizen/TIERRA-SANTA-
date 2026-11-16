import { expect, it, vi } from "vitest";
import { permitePeticionVistaPrevia } from "@/lib/vista-previa";
const url = (ruta: string) => `https://ejemplo.supabase.co${ruta}`;
it("la vista previa permite consultas, sesión y comprobantes firmados", () => {
  for (const [ruta, metodo] of [["/rest/v1/entregas_proveedor", "GET"], ["/rest/v1/rpc/estado_cuenta_proveedor", "POST"], ["/rest/v1/rpc/gastos_resumen", "POST"], ["/auth/v1/token", "POST"], ["/auth/v1/logout", "POST"], ["/storage/v1/object/sign/gastos", "POST"]]) {
    expect(permitePeticionVistaPrevia(url(ruta), metodo)).toBe(true);
  }
});
it("bloquea escritura de negocio, RPC de escritura incluso por GET, archivos y cambios de contraseña", () => {
  for (const [ruta, metodo] of [["/rest/v1/gastos", "POST"], ["/rest/v1/abonos_empleados", "PATCH"], ["/rest/v1/entregas_proveedor", "DELETE"], ["/rest/v1/rpc/emitir_factura", "POST"], ["/rest/v1/rpc/activar_control_inventario", "GET"], ["/rest/v1/rpc/registrar_acceso", "POST"], ["/storage/v1/object/gastos/foto.png", "POST"], ["/auth/v1/user", "PUT"], ["/auth/v1/admin/users", "POST"]]) {
    expect(permitePeticionVistaPrevia(url(ruta), metodo)).toBe(false);
  }
});

it("en producción las operaciones se envían al servidor sin el bloqueo de revisión", async () => {
  vi.stubEnv("NEXT_PUBLIC_VISTA_PREVIA_LECTURA", "0");
  vi.resetModules();
  const enviar = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", enviar);
  try {
    const { fetchVistaPrevia } = await import("@/lib/vista-previa");
    expect((await fetchVistaPrevia(url("/rest/v1/rpc/emitir_factura"), { method: "POST" })).status).toBe(200);
    expect(enviar).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); }
});
it("en Preview una escritura se rechaza antes de enviar cualquier petición", async () => {
  vi.stubEnv("NEXT_PUBLIC_VISTA_PREVIA_LECTURA", "1");
  vi.resetModules();
  const enviar = vi.fn(); vi.stubGlobal("fetch", enviar);
  try {
    const { fetchVistaPrevia } = await import("@/lib/vista-previa");
    expect((await fetchVistaPrevia(url("/rest/v1/rpc/emitir_factura"), { method: "POST" })).status).toBe(403);
    expect(enviar).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); }
});
