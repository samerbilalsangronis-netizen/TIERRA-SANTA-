import { expect, test } from "@playwright/test";
import { elegirOpcion, entrarComoAdmin, sufijo } from "./utilidades";

test("productos: pestañas Se vende / Fruta de proveedores, código solo en lo que se vende, validar cesta, desactivar y eliminar", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/productos");
  await expect(page.getByRole("cell", { name: "Guanábana 800 g" }).first()).toBeVisible();

  // Fruta de proveedores: sin código, compra por cesta exige kg por cesta
  const fruta = `Lulo ${sufijo()}`;
  await page.getByRole("tab", { name: /Fruta de proveedores/ }).click();
  await expect(page.getByRole("columnheader", { name: "Código" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nueva fruta" }).click();
  await expect(page.locator("input[name=codigo]")).toHaveCount(0);
  await page.fill("input[name=nombre]", fruta);
  await page.selectOption("select[name=modo_pesaje]", "FIJO");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("La compra por cesta necesita los kg por cesta")).toBeVisible();
  await page.fill("input[name=kg_por_cesta]", "12,5");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`${fruta} creado.`)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(fruta) })).toContainText("Por cesta · 12,5 kg/cesta");

  // Se vende: con código, sale de la fruta nueva, 0,8 kg por bolsa
  const codigo = String(200 + (Date.now() % 600));
  const bolsa = `${fruta} 800 g`;
  await page.getByRole("tab", { name: /Se vende/ }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page.fill("input[name=codigo]", "1");
  await page.fill("input[name=nombre]", bolsa);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ya existe un producto con el código 1.")).toBeVisible();
  await page.fill("input[name=codigo]", codigo);
  await elegirOpcion(page, "fruta_id", fruta);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Producto ${codigo} · ${bolsa} creado.`)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(bolsa) })).toContainText(fruta);

  // Búsqueda por código
  await page.getByLabel("Buscar").fill(codigo);
  await expect(page.getByRole("row")).toHaveCount(2);

  // Desactivar y eliminar (sin historial)
  await page.getByRole("button", { name: `Acciones de ${bolsa}` }).first().click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await expect(page.getByText(/Desactivado/)).toBeVisible();
  await page.getByLabel("Buscar").fill("");
  await page.getByText(/Ver inactivos/).click();
  await page.getByRole("button", { name: `Acciones de ${bolsa}` }).first().click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Eliminado.")).toBeVisible();
});

test("tareas de nómina: cambiar el precio", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/tareas");
  await page.getByRole("button", { name: "Acciones de Despulpar Mango" }).first().click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await page.fill("input[name=valor]", "2.500");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Tarea actualizada/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Despulpar Mango/ })).toContainText("$ 2.500 / cesta");
});

test("ubicaciones: por ahora solo la principal está activa", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/ubicaciones");
  await expect(page.getByRole("row", { name: /Planta principal/ })).toContainText("Predeterminada");
  await expect(page.getByRole("row", { name: /Galpón/ })).toHaveCount(0);
  await page.getByText(/Ver inactivos/).click();
  await expect(page.getByRole("row", { name: /Galpón/ })).toBeVisible();
});

test("monedas: activar VES y registrar tasa", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/monedas");
  // Repetible: si VES ya está activa, primero se desactiva
  const acciones = page.getByRole("button", { name: "Acciones de Bolívar" }).first();
  if (await acciones.isVisible()) {
    await acciones.click();
    await page.getByRole("menuitem", { name: "Desactivar" }).click();
    await expect(page.getByText(/Desactivado/)).toBeVisible();
  }
  await page.getByText(/Ver inactivos/).click();
  await acciones.click();
  await page.getByRole("menuitem", { name: "Activar" }).click();
  await expect(page.getByText("Activado.")).toBeVisible();
  await page.getByRole("button", { name: "Registrar tasa" }).click();
  await page.fill("input[name=tasa]", "4.150");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Tasa registrada.")).toBeVisible();
  await expect(page.getByText(/1 USD.*4\.150.*COP/).first()).toBeVisible();
});

test("respaldo completo en Excel", async ({ page }) => {
  await entrarComoAdmin(page);
  const r = await page.request.get("/configuracion/respaldo");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("spreadsheetml");
  expect((await r.body()).length).toBeGreaterThan(5000);
});
