import { expect, test } from "@playwright/test";
import { entrarComoAdmin, sufijo } from "./utilidades";

test("productos: crear con código, validar FIJO, código duplicado, desactivar y eliminar", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/productos");
  await expect(page.getByRole("cell", { name: "Guanábana" }).first()).toBeVisible();

  const codigo = String(100 + (Date.now() % 800));
  const nombre = `Lulo ${sufijo()}`;
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page.fill("input[name=codigo]", codigo);
  await page.fill("input[name=nombre]", nombre);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Los rubros FIJO necesitan kg por cesta")).toBeVisible();
  await page.fill("input[name=kg_por_cesta]", "12,5");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Producto ${codigo} · ${nombre} creado.`)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(nombre) })).toContainText("12,5 kg/cesta");

  // Código repetido
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page.fill("input[name=codigo]", "1");
  await page.fill("input[name=nombre]", `Otro ${sufijo()}`);
  await page.selectOption("select[name=tipo]", "terminado");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ya existe un producto con el código 1.")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Búsqueda por código
  await page.getByLabel("Buscar").fill(codigo);
  await expect(page.getByRole("row")).toHaveCount(2);

  // Desactivar y eliminar (sin historial)
  await page.getByRole("button", { name: `Acciones de ${nombre}` }).first().click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await expect(page.getByText(/Desactivado/)).toBeVisible();
  await page.getByLabel("Buscar").fill("");
  await page.getByText(/Ver inactivos/).click();
  await page.getByRole("button", { name: `Acciones de ${nombre}` }).first().click();
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

test("ubicaciones: una sola predeterminada", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/ubicaciones");
  await page.getByRole("button", { name: "Acciones de Galpón" }).first().click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await page.getByText("Ubicación predeterminada").click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ubicación guardada.")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Predeterminada" })).toHaveCount(1);
  await expect(page.getByRole("row", { name: /Galpón/ })).toContainText("Predeterminada");
  // Restaurar
  await page.getByRole("button", { name: "Acciones de Planta principal" }).first().click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await page.getByText("Ubicación predeterminada").click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ubicación guardada.")).toBeVisible();
});

test("monedas: activar VES y registrar tasa", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/catalogos/monedas");
  await page.getByText(/Ver inactivos/).click();
  await page.getByRole("button", { name: "Acciones de Bolívar" }).first().click();
  await page.getByRole("menuitem", { name: "Activar" }).click();
  await expect(page.getByText("Activado.")).toBeVisible();
  await page.getByRole("button", { name: "Registrar tasa" }).click();
  await page.fill("input[name=tasa]", "4.150");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Tasa registrada.")).toBeVisible();
  await expect(page.getByText(/1 USD.*4\.150.*COP/)).toBeVisible();
});

test("respaldo completo en Excel", async ({ page }) => {
  await entrarComoAdmin(page);
  const r = await page.request.get("/configuracion/respaldo");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("spreadsheetml");
  expect((await r.body()).length).toBeGreaterThan(5000);
});
