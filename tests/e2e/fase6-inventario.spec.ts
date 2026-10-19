import { expect, test, type Page } from "@playwright/test";
import { activarControlInventario, entrarComoAdmin } from "./utilidades";

const numero = (t: string) => Number(t.replace(/[^\d,-]/g, "").replace(",", "."));

/** Total del producto en el kardex (cabecera). */
async function totalKardex(page: Page, productoId: string) {
  await page.goto(`/inventario/${productoId}`);
  return numero((await page.locator("section p.text-2xl").first().textContent()) ?? "");
}

test("inventario: producción diaria, merma, traslado, ajuste, kardex, Excel y eliminar producción", async ({ page }) => {
  await entrarComoAdmin(page);

  // Id de la guanábana (código 1) desde el stock
  await page.goto("/inventario");
  const enlace = page.getByRole("link", { name: /Guanábana 800 g/ }).first();
  const productoId = (await enlace.getAttribute("href"))!.split("/").pop()!;
  const inicial = await totalKardex(page, productoId);

  // Producción del día con Enter entre productos
  await page.goto("/inventario/produccion");
  await page.getByLabel("Cantidad producida de Guanábana 800 g").fill("50");
  await page.getByLabel("Cantidad producida de Guanábana 800 g").press("Enter");
  await expect(page.getByLabel("Cantidad producida de Parchita 800 g")).toBeFocused();
  await page.keyboard.type("12,5");
  await page.getByRole("button", { name: "Guardar producción" }).click();
  await expect(page).toHaveURL(/vista=produccion/);
  await expect(page.getByText(/Producción registrada: 2 productos/)).toBeVisible();
  await expect(page.getByText(/Guanábana 800 g 50 bolsa/).first()).toBeVisible();
  expect(await totalKardex(page, productoId)).toBeCloseTo(inicial + 50, 3);

  // Gráfico de pulpa por rubro: la guanábana aparece con su porcentaje (esta semana y en inventario)
  await page.goto("/inventario?pulpa=semana");
  const grafico = page.getByRole("region", { name: "Porcentaje de pulpa por rubro" });
  await expect(grafico.getByRole("button", { name: /Guanábana .* %/ })).toBeVisible();
  await grafico.getByRole("tab", { name: "En inventario" }).click();
  await expect(page).toHaveURL(/\/inventario$/);
  await expect(grafico.getByRole("img")).toBeVisible();
  await page.goto(`/inventario/${productoId}`);

  // Merma desde el kardex (producto ya elegido)
  await page.getByRole("button", { name: "Merma" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel(/Cantidad/).fill("4");
  await dialogo.getByLabel(/Motivo/).fill("Se descongeló por corte de luz");
  await dialogo.getByRole("button", { name: "Registrar merma" }).click();
  await expect(page.getByText(/Merma registrada/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "Merma" }).first()).toBeVisible();
  expect(await totalKardex(page, productoId)).toBeCloseTo(inicial + 46, 3);

  // Con una sola ubicación no hay traslados ni se elige ubicación
  await expect(page.getByRole("button", { name: "Traslado" })).toHaveCount(0);

  // Ajuste por conteo: se cuenta 1 menos de lo que hay
  const hay = await totalKardex(page, productoId);
  await page.getByRole("button", { name: "Ajuste" }).click();
  await expect(dialogo.locator("select")).toHaveCount(1); // solo el producto
  // (si en la base de prueba quedó negativo, se cuentan 5 más)
  const conteo = hay >= 1 ? hay - 1 : 5;
  await dialogo.getByLabel(/Cantidad contada/).fill(String(conteo).replace(".", ","));
  await dialogo.getByLabel(/Motivo/).fill("Conteo del viernes");
  await expect(dialogo.getByText(/· diferencia/)).toContainText(hay >= 1 ? "-1" : "diferencia");
  await dialogo.getByRole("button", { name: "Guardar conteo" }).click();
  await expect(page.getByText(/Ajuste registrado/)).toBeVisible();
  expect(await totalKardex(page, productoId)).toBeCloseTo(conteo, 3);

  // Excel del kardex y del stock
  for (const url of [`/inventario/${productoId}/excel`, "/inventario/excel"]) {
    const r = await page.request.get(url);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("spreadsheetml");
  }

  // Movimientos filtrados por merma
  await page.goto("/inventario?vista=movimientos&tipo=merma");
  await expect(page.getByText("Se descongeló por corte de luz").first()).toBeVisible();

  // Eliminar la producción (admin): el stock vuelve
  await page.goto("/inventario?vista=produccion");
  await page.getByRole("button", { name: /Eliminar producción/ }).first().click();
  await page.getByLabel("Motivo").fill("Registrada por error");
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(/Producción eliminada/)).toBeVisible();
  expect(await totalKardex(page, productoId)).toBeCloseTo(conteo - 50, 3);
});

test("inventario: agregar un producto nuevo desde Inventario y producirlo", async ({ page }) => {
  await entrarComoAdmin(page);
  const nombre = `Pulpa de Lulo ${Date.now().toString(36).slice(-4)}`;
  await page.goto("/inventario");
  await page.getByRole("link", { name: "Nuevo producto" }).click();
  await expect(page).toHaveURL(/catalogos\/productos\?nuevo=1/);
  await page.fill("input[name=nombre]", nombre);
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/inventario");
  await expect(page.getByRole("link", { name: new RegExp(nombre) }).first()).toBeVisible();
  await page.goto("/inventario/produccion");
  await page.getByLabel(`Cantidad producida de ${nombre}`).fill("15");
  await page.getByRole("button", { name: "Guardar producción" }).click();
  await expect(page.getByText(new RegExp(`${nombre} 15 bolsa`)).first()).toBeVisible();
});

test("una sola ubicación: ni la factura ni la producción piden ubicación", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/facturacion/nueva");
  await expect(page.getByText("Sale de")).toHaveCount(0);
  await page.goto("/inventario/produccion");
  await expect(page.getByText("Se guarda en")).toHaveCount(0);
});

test("antes del inventario general la factura no descuenta; al activar el control sí", async ({ page }) => {
  await entrarComoAdmin(page);
  await activarControlInventario(page);
  // Desactivar: la factura no muestra "Disponible" ni avisa de stock
  await page.goto("/inventario");
  await page.getByRole("button", { name: "Dejar de descontar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Dejar de descontar" }).click();
  await expect(page.getByText("Las facturas todavía no descuentan del inventario")).toBeVisible();
  await page.goto("/facturacion/nueva");
  await page.getByLabel("Buscar cliente").fill("1");
  await page.getByLabel("Buscar cliente").press("Enter");
  const codigo = page.getByLabel("Código o nombre del producto").first();
  await codigo.fill("1");
  await codigo.press("Enter");
  await page.keyboard.type("99999");
  await expect(page.getByTestId("linea-factura").first()).not.toContainText(/Disponible|Solo hay/);
  await expect(page.getByText(/sin stock suficiente|No hay stock suficiente/)).toHaveCount(0);
  // Volver a activar (lo dejan así las demás pruebas)
  await activarControlInventario(page);
  await page.goto("/facturacion/nueva");
  await page.getByLabel("Buscar cliente").fill("1");
  await page.getByLabel("Buscar cliente").press("Enter");
  await codigo.fill("1");
  await codigo.press("Enter");
  await expect(page.getByTestId("linea-factura").first()).toContainText(/Disponible|Solo hay/);
});
