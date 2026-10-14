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

test("proveedor: compras por kilo, por unidad y por cesta, abonos, cestas, saldos y estado de cuenta", async ({ page }) => {
  await entrarComoAdmin(page);
  const nombre = `Finca Prueba ${sufijo()}`;
  await crearProveedor(page, nombre);
  const resumen = page.getByRole("dialog").locator("[aria-live=polite]");

  // Por kilo: 400 kg de guanábana a 3.000/kg con 10 kg de merma → 1.170.000
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await elegirOpcion(page, "producto_id", "Guanábana");
  await expect(page.getByRole("radio", { name: "Por kilo" })).toHaveAttribute("aria-checked", "true");
  await page.fill("input[name=kg_total]", "400");
  await page.fill("input[name=precio]", "3.000");
  await page.fill("input[name=merma]", "10");
  await expect(resumen).toContainText("390 kg");
  await expect(resumen).toContainText("COP $ 30.000");
  await expect(resumen).toContainText("COP $ 1.170.000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.").first()).toBeVisible();

  // Por unidad: 80 piñas a 2.500 con 2 dañadas → 195.000
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await elegirOpcion(page, "producto_id", "Piña");
  await expect(page.getByRole("radio", { name: "Por unidad" })).toHaveAttribute("aria-checked", "true");
  await page.fill("input[name=unidades]", "80");
  await page.fill("input[name=precio]", "2.500");
  await page.fill("input[name=merma]", "2");
  await expect(resumen).toContainText("78 und");
  await expect(resumen).toContainText("COP $ 195.000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.").first()).toBeVisible();

  // Por cesta, en USD: 10 cestas de fresa (10 kg/c) a 6 USD con 5 kg de merma → 57
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await page.selectOption("select[name=moneda]", "USD");
  await elegirOpcion(page, "producto_id", "Fresa");
  await page.getByRole("radio", { name: "Por cesta" }).click();
  await page.fill("input[name=cestas]", "10");
  await page.fill("input[name=precio]", "6");
  await page.fill("input[name=merma]", "5");
  await expect(resumen).toContainText("USD $ 57,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.").first()).toBeVisible();

  // Saldos por moneda y cestas anotadas
  await expect(page.getByText("COP $ 1.365.000").first()).toBeVisible();
  await expect(page.getByText("USD $ 57,00").first()).toBeVisible();
  await expect(page.getByText("10 entregadas")).toBeVisible();
  await expect(page.getByRole("row", { name: /Guanábana/ })).toContainText("400 kg");
  await expect(page.getByRole("row", { name: /Piña/ })).toContainText("80 und");

  // Abono COP
  await page.getByRole("button", { name: "Abonar", exact: true }).click();
  await page.fill("input[name=monto]", "365.000");
  await page.fill("input[name=pagado_por]", "Samer");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Abono registrado.")).toBeVisible();
  await expect(page.getByText("COP $ 1.000.000").first()).toBeVisible();

  // Devolución de cestas
  await page.getByRole("button", { name: "Cestas", exact: true }).click();
  await page.fill("input[name=devueltas]", "4");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cestas registradas.")).toBeVisible();
  await expect(page.getByText("10 entregadas · 4 devueltas")).toBeVisible();

  // Estado de cuenta COP
  await page.getByRole("link", { name: /Estado de cuenta COP/ }).click();
  await expect(page.getByText("ESTADO DE CUENTA", { exact: true })).toBeVisible();
  await expect(page.getByText(/Guanábana · 400 kg × 3000 · merma 10 kg/)).toBeVisible();
  await expect(page.getByText(/Piña · 80 und × 2500 · merma 2 und/)).toBeVisible();
  await expect(page.locator("article")).toContainText("COP $ 1.000.000");
  const excel = await page.request.get(page.url().replace("/estado-cuenta?", "/estado-cuenta/excel?"));
  expect(excel.status()).toBe(200);

  // Panel: filtro "Deben USD" y búsqueda
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Deben USD" }).click();
  await expect(page.getByRole("link", { name: new RegExp(nombre) })).toBeVisible();
  await page.getByLabel("Buscar proveedor").fill("zzzz-no-existe");
  await expect(page.getByText("Ningún proveedor coincide")).toBeVisible();
});

test("proveedor de insumos: bolsas por unidad", async ({ page }) => {
  await entrarComoAdmin(page);
  // Insumo en el catálogo
  const insumo = `Bolsa 1kg ${sufijo()}`;
  await page.goto("/configuracion/catalogos/productos");
  await page.getByRole("button", { name: /Insumos/ }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await expect(page.getByRole("heading", { name: "Nuevo insumo" })).toBeVisible();
  await page.fill("input[name=codigo]", String(500 + (Date.now() % 400)));
  await page.fill("input[name=nombre]", insumo);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/creado\./)).toBeVisible();

  // Proveedor de insumos
  const nombre = `Plásticos ${sufijo()}`;
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  await page.fill("input[name=nombre]", nombre);
  await page.selectOption("select[name=tipo]", "insumos");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/proveedores\/\d+/);
  await expect(page.getByRole("button", { name: "Cestas", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await expect(page.locator("select[name=producto_id] option", { hasText: "Guanábana" })).toHaveCount(0);
  await elegirOpcion(page, "producto_id", insumo);
  await page.fill("input[name=unidades]", "1.000");
  await page.fill("input[name=precio]", "150");
  await expect(page.locator("input[name=merma]")).toHaveCount(0);
  await expect(page.getByRole("dialog").locator("[aria-live=polite]")).toContainText("COP $ 150.000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.").first()).toBeVisible();

  await page.goto("/proveedores?tipo=insumos");
  await expect(page.getByRole("link", { name: new RegExp(nombre) })).toContainText("Insumos");
});

test("proveedor en el teléfono: entrega con foto desde la cámara", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await entrarComoAdmin(page);
  const nombre = `Finca Móvil ${sufijo()}`;
  await crearProveedor(page, nombre);
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await elegirOpcion(page, "producto_id", "Fresa");
  await page.fill("input[name=kg_total]", "30");
  await page.fill("input[name=precio]", "2.500");
  await page.setInputFiles("input[type=file][capture]", "public/logo-tierra-santa-negro.png");
  await expect(page.getByText("Foto subida.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.").first()).toBeVisible();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByRole("img", { name: "Foto de la entrega" })).toBeVisible();
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/proveedor-telefono.png", fullPage: true });
  await ctx.close();
});
