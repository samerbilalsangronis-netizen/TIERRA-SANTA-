import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  usuario: process.env.E2E_ADMIN_USUARIO ?? "samer",
  clave: process.env.E2E_ADMIN_CLAVE ?? "Clave2026",
};

/** Alerta del formulario (excluye el anunciador de rutas de Next). */
export const alertaFormulario = (p: Page) => p.locator("form [role=alert]");

export async function iniciarSesion(p: Page, usuario: string, clave: string) {
  await p.goto("/");
  await p.fill("#usuario", usuario);
  await p.fill("#clave", clave);
  await p.click("button[type=submit]");
}

export async function entrarComoAdmin(p: Page) {
  await iniciarSesion(p, ADMIN.usuario, ADMIN.clave);
  await expect(p).toHaveURL(/\/dashboard/);
}

export const sufijo = () => Date.now().toString(36).slice(-5);
