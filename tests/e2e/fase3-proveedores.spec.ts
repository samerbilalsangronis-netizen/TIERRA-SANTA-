import { expect, test, type Page } from "@playwright/test";
import { elegirOpcion, entrarComoAdmin, sufijo } from "./utilidades";

async function crearProveedor(page: Page, nombre: string, moneda = "COP") {
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  await page.fill("input[name=nombre]", nombre);
  await page.fill("input[name=documento]", "V-1234567");
  await page.selectOption("select[name=moneda_habitual]", moneda);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/proveedores\/\d+/);
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
}

test("proveedor: entregas FIJO/VARIABLE con merma, abonos, cestas, saldos y estado de cuenta", async ({ page }) => {
  await entrarComoAdmin(page);
  const nombre = `Finca Prueba ${sufijo()}`;
  await crearProveedor(page, nombre);

  // Entrega FIJO: 10 cestas Guanábana (20 kg/c) a 60.000, merma 5 kg → 585.000
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await elegirOpcion(page, "producto_id", "Guanábana");
  await page.fill("input[name=cestas]", "10");
  await page.fill("input[name=precio]", "60.000");
  await page.fill("input[name=merma]", "5");
  const resumen = page.getByRole("dialog").locator("[aria-live=polite]");
  await expect(resumen).toContainText("200 kg");
  await expect(resumen).toContainText("195 kg");
  await expect(resumen).toContainText("COP $ 3.000");
  await expect(resumen).toContainText("COP $ 15.000");
  await expect(resumen).toContainText("COP $ 585.000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.")).toBeVisible();

  // Entrega VARIABLE en USD: Piña 80 kg por 40 USD, merma 4 → 38
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await page.selectOption("select[name=moneda]", "USD");
  await elegirOpcion(page, "producto_id", "Piña");
  await page.fill("input[name=kg_total]", "80");
  await page.fill("input[name=precio]", "40");
  await page.fill("input[name=merma]", "4");
  await expect(page.getByRole("dialog").locator("[aria-live=polite]")).toContainText("USD $ 38,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.")).toBeVisible();

  // Saldos por moneda y cestas anotadas
  await expect(page.getByText("COP $ 585.000").first()).toBeVisible();
  await expect(page.getByText("USD $ 38,00").first()).toBeVisible();
  await expect(page.getByText("10 entregadas")).toBeVisible();

  // Abono COP
  await page.getByRole("button", { name: "Abonar", exact: true }).click();
  await page.fill("input[name=monto]", "85.000");
  await page.fill("input[name=pagado_por]", "Samer");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Abono registrado.")).toBeVisible();
  await expect(page.getByText("COP $ 500.000").first()).toBeVisible();

  // Devolución de cestas
  await page.getByRole("button", { name: "Cestas", exact: true }).click();
  await page.fill("input[name=devueltas]", "4");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cestas registradas.")).toBeVisible();
  await expect(page.getByText("10 entregadas · 4 devueltas")).toBeVisible();

  // Estado de cuenta COP
  await page.getByRole("link", { name: /Estado de cuenta COP/ }).click();
  await expect(page.getByText("ESTADO DE CUENTA", { exact: true })).toBeVisible();
  await expect(page.getByText("Guanábana · 10 cestas")).toBeVisible();
  await expect(page.getByText("Saldo a favor del proveedor")).toBeVisible();
  await expect(page.locator("article")).toContainText("COP $ 500.000");
  const excel = await page.request.get(page.url().replace("/estado-cuenta?", "/estado-cuenta/excel?"));
  expect(excel.status()).toBe(200);

  // Panel: filtro "Deben USD" y búsqueda
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Deben USD" }).click();
  await expect(page.getByRole("link", { name: new RegExp(nombre) })).toBeVisible();
  await page.getByLabel("Buscar proveedor").fill("zzzz-no-existe");
  await expect(page.getByText("Ningún proveedor coincide")).toBeVisible();
});

test("proveedor en el teléfono: entrega con foto desde la cámara", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await entrarComoAdmin(page);
  const nombre = `Finca Móvil ${sufijo()}`;
  await crearProveedor(page, nombre);
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await elegirOpcion(page, "producto_id", "Fresa");
  await page.fill("input[name=cestas]", "3");
  await page.fill("input[name=precio]", "25.000");
  await page.setInputFiles("input[type=file][capture]", "public/logo-tierra-santa-negro.png");
  await expect(page.getByText("Foto subida.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.")).toBeVisible();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByRole("img", { name: "Foto de la entrega" })).toBeVisible();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/proveedor-telefono.png", fullPage: true });
  await ctx.close();
});
