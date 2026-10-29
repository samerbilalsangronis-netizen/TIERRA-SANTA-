import { expect, test } from "@playwright/test";
import { entrarComoAdmin, sufijo } from "./utilidades";

test("gastos: registrar, concepto nuevo, corregir, eliminar, reporte y dashboard", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/gastos");
  await expect(page.getByRole("heading", { name: "Gastos" })).toBeVisible();

  // Guantes: 2 cajas por 30.000 COP
  await page.getByRole("button", { name: "Nuevo gasto" }).click();
  const dialogo = page.getByRole("dialog");
  const concepto = dialogo.locator("select[name=concepto_id]");
  await concepto.selectOption({ label: "Guantes" });
  await dialogo.locator("input[name=cantidad]").fill("2");
  await dialogo.locator("input[name=monto]").fill("30.000");
  await dialogo.locator("select[name=moneda]").selectOption("COP");
  await dialogo.getByLabel("Dónde se compró").fill("Ferretería");
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Gasto registrado.").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /Guantes/ }).first()).toBeVisible();

  // Concepto nuevo desde el mismo formulario
  const nombre = `Detergente ${sufijo()}`;
  await page.getByRole("button", { name: "Nuevo gasto" }).click();
  await concepto.selectOption("__nuevo__");
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo.getByRole("button", { name: "Agregar concepto" }).click();
  await expect(page.getByText(`${nombre} agregado.`)).toBeVisible();
  await expect(concepto).toHaveValue(/\d+/);
  await dialogo.locator("input[name=monto]").fill("12.500");
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Gasto registrado.").first()).toBeVisible();
  const fila = page.getByRole("row", { name: new RegExp(nombre) });
  await expect(fila).toContainText("12.500");

  // Corregir el monto
  await fila.getByRole("button", { name: /Acciones del gasto/ }).click();
  await page.getByRole("menuitem", { name: "Corregir" }).click();
  await dialogo.locator("input[name=monto]").fill("13.000");
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Gasto corregido.")).toBeVisible();
  await expect(fila).toContainText("13.000");

  // Reporte y dashboard
  await page.goto("/reportes/gastos");
  await expect(page.getByText("GASTOS POR CATEGORÍA")).toBeVisible();
  await expect(page.getByRole("row", { name: /Higiene y protección.*Guantes/ })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(nombre) })).toContainText("13.000");
  const excel = await page.request.get("/reportes/gastos/excel");
  expect(excel.status()).toBe(200);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "ver gastos" })).toBeVisible();

  // Eliminar
  await page.goto("/gastos");
  await page.getByRole("row", { name: new RegExp(nombre) }).getByRole("button", { name: /Acciones del gasto/ }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Gasto eliminado.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(nombre) })).toHaveCount(0);

  // El concepto quedó en Configuración → Catálogos → Gastos
  await page.goto("/configuracion/catalogos/gastos");
  await expect(page.getByText(nombre).first()).toBeVisible();
});
