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
