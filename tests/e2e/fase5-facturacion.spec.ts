import { expect, test, type Page } from "@playwright/test";
import { entrarComoAdmin, sufijo } from "./utilidades";

/** Lee "Disponible N kg" de la primera línea de la factura que se está escribiendo. */
async function disponibleEnPantalla(page: Page): Promise<number> {
  const texto = (await page.getByTestId("linea-factura").first().getByText(/Disponible|Solo hay/).textContent()) ?? "";
  const m = /(-?[\d.]+(?:,\d+)?)\s*kg/.exec(texto);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
}

test("facturación: emitir con teclado → inventario → cuenta por cobrar, editar con historial, PDF, duplicar y anular", async ({ page }) => {
  await entrarComoAdmin(page);
  const nombre = `Pulpas Andinas ${sufijo()}`;

  // Cliente nuevo creado desde la propia factura, sin salir
  await page.goto("/facturacion/nueva");
  await page.getByRole("button", { name: /Cliente nuevo|Nuevo/ }).click();
  await page.fill("input[name=nombre]", nombre);
  await page.fill("input[name=documento]", "J-40123456-7");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("cliente-elegido")).toHaveText(nombre);

  // Línea 1 por código con Enter: 1 → Guanábana, 12,5 kg a 4
  const codigo = page.getByLabel("Código o nombre del producto");
  await codigo.first().fill("1");
  await expect(page.getByTestId("linea-factura").first()).toContainText("Guanábana");
  const antes = await disponibleEnPantalla(page);
  await codigo.first().press("Enter");
  await expect(page.getByLabel("Cantidad línea 1")).toBeFocused();
  await page.keyboard.type("12,5");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Precio línea 1")).toBeFocused();
  await page.keyboard.type("4");
  await page.keyboard.press("Enter");
  // Línea 2 buscando por nombre
  await expect(codigo.nth(1)).toBeFocused();
  await page.keyboard.type("parch");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Cantidad línea 2")).toBeFocused();
  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Precio línea 2")).toBeFocused();
  await page.keyboard.type("3");
  await page.getByLabel("IVA línea 2").check();
  // 12,5 × 4 = 50 exento + 30 con IVA 16% (4,80) = 84,80
  await expect(page.getByTestId("total-factura")).toHaveText("USD $ 84,80");

  await page.getByRole("button", { name: /^Emitir/ }).click();
  await expect(page).toHaveURL(/\/facturacion\/\d+$/);
  await expect(page.getByText(/FACTURA\s+Nº/)).toBeVisible();
  await expect(page.getByText("OCHENTA Y CUATRO DÓLARES CON 80/100")).toBeVisible();
  await expect(page.getByText("Pendiente").first()).toBeVisible();
  const urlFactura = page.url();
  const numero = (await page.getByText(/FACTURA\s+Nº/).textContent())!.replace(/.*Nº\s*/, "").trim();

  // PDF
  const pdf = await page.request.get(`${urlFactura}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Inventario: la guanábana bajó 12,5
  await page.goto("/facturacion/nueva");
  await page.getByLabel("Buscar cliente").fill(nombre);
  await page.getByLabel("Buscar cliente").press("Enter");
  await codigo.first().fill("1");
  expect(await disponibleEnPantalla(page)).toBeCloseTo(antes - 12.5, 3);
  // Sugerencia del último precio usado con este cliente
  await codigo.first().press("Enter");
  await expect(page.getByLabel("Precio línea 1")).toHaveValue("4");

  // Cuenta por cobrar: aparece en la ficha del cliente
  await page.goto("/facturacion");
  await page.getByLabel("Buscar factura").fill(nombre);
  await expect(page.getByRole("row", { name: new RegExp(numero) })).toBeVisible();
  await expect(page).toHaveURL(/\?q=/);
  await page.getByRole("row", { name: new RegExp(numero) }).getByRole("link", { name: nombre }).click();
  await expect(page).toHaveURL(/\/clientes\/\d+/);
  await expect(page.getByText("Debe USD")).toBeVisible();
  await expect(page.getByText("USD $ 84,80").first()).toBeVisible();

  // Editar: mismo número, más cantidad, motivo en el historial
  await page.goto(`${urlFactura}/editar`);
  await page.getByLabel("Cantidad línea 1").fill("20");
  await page.getByLabel(/Motivo del cambio/).fill("Se llevó más guanábana");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(urlFactura);
  await expect(page.getByText(/FACTURA\s+Nº/)).toContainText(numero);
  await expect(page.getByText("Editada (versión 2)")).toBeVisible();
  await expect(page.getByText("Motivo: Se llevó más guanábana")).toBeVisible();
  await expect(page.getByText("USD $ 114,80").first()).toBeVisible();

  // Duplicar: abre una factura nueva con las mismas líneas
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: /Duplicar/ }).click();
  await expect(page).toHaveURL(/duplicar=/);
  await expect(page.getByTestId("total-factura")).toHaveText("USD $ 114,80");
  await page.getByRole("button", { name: /borrador/i }).click();
  await expect(page).toHaveURL(/estado=borrador/);
  await expect(page.getByRole("row", { name: new RegExp(nombre) })).toContainText("Borrador");

  // Anular con motivo: sello ANULADA y sale de la deuda
  await page.goto(urlFactura);
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Anular" }).click();
  await page.getByLabel("Motivo de la anulación").fill("Error de prueba");
  await page.getByRole("button", { name: "Anular factura" }).click();
  await expect(page.getByText("ANULADA", { exact: true })).toBeVisible();
  await expect(page.getByText("Anulada").first()).toBeVisible();
});
