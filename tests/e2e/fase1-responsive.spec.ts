import { expect, test } from "@playwright/test";
import { entrarComoAdmin } from "./utilidades";

// Se ejecuta en PC y en teléfono (proyecto "telefono")
test("menú y dashboard usables en cualquier pantalla", async ({ page, isMobile }) => {
  await entrarComoAdmin(page);
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
  }
  const nav = page.getByRole("navigation", { name: "Principal" }).last();
  await expect(nav.getByRole("link", { name: "Configuración" })).toBeVisible();
  await nav.getByRole("link", { name: "Configuración" }).click();
  await expect(page).toHaveURL(/\/configuracion/);
  // Sin scroll horizontal
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
});

test("catálogos en pantalla pequeña: tarjetas y formulario", async ({ page, isMobile }) => {
  test.skip(!isMobile, "solo teléfono");
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/productos");
  const tarjeta = page.getByRole("button", { name: /Guanábana.*kg/ });
  await expect(tarjeta).toBeVisible();
  await tarjeta.click(); // tocar la tarjeta abre la edición
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("heading", { name: /Editar 1 · Guanábana/ })).toBeVisible();
  await expect(dialogo.getByRole("button", { name: "Guardar" })).toBeInViewport();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/productos-telefono.png" });
});
