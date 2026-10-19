import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  correo: process.env.E2E_ADMIN_CORREO ?? "admin@tierrasanta.test",
  clave: process.env.E2E_ADMIN_CLAVE ?? "Clave2026",
};

/** Alerta del formulario (excluye el anunciador de rutas de Next). */
export const alertaFormulario = (p: Page) => p.locator("form [role=alert]");

export async function iniciarSesion(p: Page, correo: string, clave: string) {
  await p.goto("/");
  await p.fill("#correo", correo);
  await p.fill("#clave", clave);
  await p.click("button[type=submit]");
}

export async function entrarComoAdmin(p: Page) {
  await iniciarSesion(p, ADMIN.correo, ADMIN.clave);
  await expect(p).toHaveURL(/\/dashboard/);
}

export const sufijo = () => Date.now().toString(36).slice(-5);

/** Elige en un <select name=…> la primera opción cuyo texto contenga `texto`. */
export async function elegirOpcion(p: Page, nombre: string, texto: string) {
  const valor = await p.locator(`select[name=${nombre}] option`, { hasText: texto }).first().getAttribute("value");
  await p.selectOption(`select[name=${nombre}]`, valor ?? "");
}

/** Deja activo el descuento de inventario al facturar (si no lo estaba). */
export async function activarControlInventario(p: Page) {
  await p.goto("/inventario");
  const boton = p.getByRole("button", { name: "Empezar a descontar al facturar" });
  if (await boton.isVisible()) {
    await boton.click();
    await p.getByRole("alertdialog").getByRole("button", { name: "Empezar a descontar" }).click();
    await expect(p.getByText(/Las facturas descuentan del inventario desde/)).toBeVisible();
  }
}
