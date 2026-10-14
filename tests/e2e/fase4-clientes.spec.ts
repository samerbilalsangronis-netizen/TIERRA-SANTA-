import { expect, test, type Page } from "@playwright/test";
import { entrarComoAdmin, sufijo } from "./utilidades";

async function facturaHistorica(page: Page, numero: string, fecha: string, monto: string, moneda = "USD") {
  await page.getByRole("button", { name: "Factura histórica" }).click();
  await page.fill("input[name=numero_externo]", numero);
  await page.fill("input[name=fecha]", fecha);
  await page.selectOption("select[name=moneda]", moneda);
  await page.fill("input[name=total]", monto);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Factura ${numero} registrada.`)).toBeVisible();
}

test("cliente: facturas, pago múltiple con reparto automático, saldo a favor, recibo, anulación y estado de cuenta", async ({ page }) => {
  await entrarComoAdmin(page);
  const nombre = `Carlos Roa ${sufijo()}`;
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  await page.fill("input[name=nombre]", nombre);
  await page.fill("input[name=documento]", "V-12345678");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/clientes\/\d+/);
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();

  const s = sufijo();
  await facturaHistorica(page, `101-${s}`, "2026-09-01", "1.310");
  await facturaHistorica(page, `102-${s}`, "2026-09-10", "1.000");
  await facturaHistorica(page, `103-${s}`, "2026-10-01", "1.500");
  await facturaHistorica(page, `C-${s}`, "2026-10-05", "350.000", "COP");
  await expect(page.getByText("USD $ 3.810,00").first()).toBeVisible();
  await expect(page.getByText("COP $ 350.000").first()).toBeVisible();
  await expect(page.getByText("CRÍTICO").first()).toBeVisible();

  // Pago múltiple: se marcan las 3 USD, se reciben 3.210 y se reparte automáticamente
  for (const n of [`101-${s}`, `102-${s}`, `103-${s}`]) await page.getByRole("checkbox", { name: `Marcar factura ${n}` }).first().click();
  await expect(page.getByRole("checkbox", { name: `Marcar factura C-${s}` }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.locator("#monto-recibido").fill("3.210");
  await dialogo.getByRole("button", { name: /Repartir/ }).click();
  await expect(dialogo.getByLabel(`Monto a abonar a 103-${s}`)).toHaveValue("900");
  await dialogo.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByText(/Pago registrado \(recibo nº \d+\)\./)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`101-${s}`) })).toContainText("Pagada");
  await expect(page.getByRole("row", { name: new RegExp(`103-${s}`) })).toContainText("Abonada");
  await expect(page.getByText("USD $ 600,00").first()).toBeVisible();

  // Pagar completa la 103 con 700: formulario simple de un solo monto; sobran 100
  await page.getByRole("row", { name: new RegExp(`103-${s}`) }).getByRole("button", { name: "Pagar completa" }).click();
  await expect(dialogo.getByLabel(/Monto a pagar/)).toHaveValue("600");
  await dialogo.getByLabel(/Monto a pagar/).fill("700");
  await expect(dialogo.getByText(/El excedente .* se descuenta de las otras facturas/)).toBeVisible();
  await dialogo.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByText(/no tiene más facturas pendientes/)).toBeVisible();
  await expect(page.getByText("Pagó de más USD")).toBeVisible();

  // Nueva factura: lo pagado de más se descuenta solo
  await facturaHistorica(page, `104-${s}`, "2026-10-10", "250");
  await expect(page.getByRole("row", { name: new RegExp(`104-${s}`) })).toContainText("Abonada");
  await expect(page.getByText("USD $ 150,00").first()).toBeVisible();

  // Abonar 50 a la 104 con el formulario simple
  await page.getByRole("row", { name: new RegExp(`104-${s}`) }).getByRole("button", { name: "Abonar" }).click();
  await dialogo.getByLabel(/Monto a abonar/).fill("50");
  await expect(dialogo.getByText("USD $ 100,00")).toBeVisible();
  await dialogo.getByRole("button", { name: "Registrar abono" }).click();
  await expect(page.getByText(/Pago registrado/).first()).toBeVisible();
  await expect(page.getByText("USD $ 100,00").first()).toBeVisible();

  // Recibo imprimible (el del pago múltiple, el más antiguo)
  await page.getByRole("tab", { name: /Pagos/ }).click();
  await page.getByRole("button", { name: /Acciones del recibo/ }).last().click();
  await page.getByRole("menuitem", { name: /Ver \/ imprimir recibo/ }).click();
  await expect(page.getByText(/RECIBO DE PAGO Nº/)).toBeVisible();
  await expect(page.locator("article")).toContainText("USD $ 3.210,00");
  await page.goBack();

  // Anular la 104: lo pagado (150) queda para la próxima factura
  await page.getByRole("tab", { name: /Facturas/ }).click();
  await page.getByRole("button", { name: `Acciones de la factura 104-${s}` }).first().click();
  await page.getByRole("menuitem", { name: "Anular" }).click();
  await page.getByLabel("Motivo de la anulación").fill("Prueba de anulación");
  await page.getByRole("button", { name: "Anular factura" }).click();
  await expect(page.getByText(/Factura anulada/)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`104-${s}`) })).toContainText("Anulada");

  // Cajas
  await page.getByRole("button", { name: "Cajas", exact: true }).click();
  await page.fill("input[name=retiradas]", "12");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Movimiento de cajas registrado.")).toBeVisible();

  // Estado de cuenta USD: cuadra con el saldo (150 pagados de más)
  await page.getByRole("link", { name: /Estado de cuenta USD/ }).click();
  await expect(page.getByText("ESTADO DE CUENTA", { exact: true })).toBeVisible();
  await expect(page.locator("article")).toContainText("Pagado de más");
  await expect(page.locator("article")).toContainText("USD $ 150,00");
  const excel = await page.request.get(page.url().replace("/estado-cuenta?", "/estado-cuenta/excel?"));
  expect(excel.status()).toBe(200);

  // Panel: buscar y filtrar
  await page.goto("/clientes");
  await page.getByLabel("Buscar cliente").fill(nombre);
  await expect(page.getByRole("link", { name: new RegExp(nombre) })).toContainText("COP $ 350.000");
  await page.goto("/clientes/antiguedad?moneda=COP");
  await expect(page.getByRole("link", { name: nombre })).toBeVisible();
});
