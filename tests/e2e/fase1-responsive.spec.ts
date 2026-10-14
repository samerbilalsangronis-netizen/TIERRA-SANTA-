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
  const tarjeta = page.getByRole("button", { name: /Guanábana 800 g.*bolsa/ });
  await expect(tarjeta).toBeVisible();
  await tarjeta.click(); // tocar la tarjeta abre la edición
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("heading", { name: /Editar 1 · Guanábana 800 g/ })).toBeVisible();
  await expect(dialogo.getByRole("button", { name: "Guardar" })).toBeInViewport();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/productos-telefono.png" });
});

test("ficha de cliente en el teléfono: sin desbordes y con botones de pago", async ({ page, isMobile }) => {
  test.skip(!isMobile, "solo teléfono");
  await entrarComoAdmin(page);
  await page.goto("/clientes?estado=CR%C3%8DTICO");
  const primero = page.locator("a[href^='/clientes/']").filter({ hasNotText: "Antigüedad" }).first();
  test.skip((await primero.count()) === 0, "no hay clientes con deuda en la base de prueba");
  await primero.click();
  await expect(page).toHaveURL(/\/clientes\/\d+/);
  await expect(page.getByRole("button", { name: "Pagar completa" }).first()).toBeVisible();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  const botones = await page.locator("a:has-text('Cuenta')").evaluateAll((els) => els.every((e) => e.scrollWidth <= e.clientWidth + 1));
  expect(botones).toBe(true);
});

test("facturar desde el teléfono: líneas en tarjetas, total fijo abajo y sin desbordes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "solo teléfono");
  await entrarComoAdmin(page);
  await page.goto("/facturacion/nueva");
  await page.getByLabel("Buscar cliente").fill("a");
  const opcion = page.getByRole("option").first();
  test.skip((await opcion.getByRole("button").count()) === 0, "no hay clientes en la base de prueba");
  await opcion.getByRole("button").click();
  await page.getByLabel("Código o nombre del producto").first().fill("2");
  await page.getByLabel("Cantidad línea 1").fill("3");
  await page.getByLabel("Precio línea 1").fill("5");
  await expect(page.getByRole("button", { name: /^Emitir/ })).toBeInViewport();
  await expect(page.getByText("USD $ 15,00").last()).toBeInViewport();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/factura-telefono.png", fullPage: true });
  await page.goto("/facturacion");
  await expect(page.getByRole("heading", { name: "Facturación" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("inventario en el teléfono: stock en tarjetas y producción con botón fijo", async ({ page, isMobile }) => {
  test.skip(!isMobile, "solo teléfono");
  await entrarComoAdmin(page);
  for (const ruta of ["/inventario", "/inventario?vista=produccion", "/inventario?vista=movimientos"]) {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.goto("/inventario");
  await page.screenshot({ path: "test-results/inventario-telefono.png", fullPage: true });
  await page.goto("/inventario/produccion");
  await expect(page.getByRole("button", { name: "Guardar producción" })).toBeInViewport();
  await page.getByLabel("Cantidad producida de Guanábana 800 g").fill("30");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/produccion-telefono.png" });
});
