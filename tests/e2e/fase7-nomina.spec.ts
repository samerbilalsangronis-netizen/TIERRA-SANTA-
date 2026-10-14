import { expect, test, type Page } from "@playwright/test";
import { entrarComoAdmin, sufijo } from "./utilidades";

/** Fecha única por corrida (los periodos no se pueden solapar). */
function fechaUnica() {
  const d = new Date(Date.UTC(2031, 0, 1) + (Date.now() % 3000) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function crearEmpleado(page: Page, nombre: string, tipo: "fijo" | "destajo", tarifa = "") {
  await page.goto("/nomina");
  await page.getByRole("button", { name: "Nuevo empleado" }).click();
  await page.fill("input[name=nombre]", nombre);
  await page.selectOption("select[name=tipo]", tipo);
  if (tarifa) await page.fill("input[name=tarifa_dia]", tarifa);
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/nomina\/\d+/);
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
  return page.url();
}

test("nómina: jornadas por tarea y fijas, asistencia rápida, abonos, cierre con pago, recibo y reapertura", async ({ page }) => {
  await entrarComoAdmin(page);
  const s = sufijo();
  const destajo = `Greismar ${s}`;
  const fijo = `Alejandro ${s}`;
  const urlDestajo = await crearEmpleado(page, destajo, "destajo");

  // Calendario: tocar hoy abre "Jornada: …"; asistió sin tareas
  await page.locator("button.ring-2[aria-label^='Jornada del']").click();
  await expect(page.getByRole("dialog").getByText(/Jornada:/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Jornada del .* guardada/)).toBeVisible();

  await crearEmpleado(page, fijo, "fijo", "40.000");
  await page.locator("button.ring-2[aria-label^='Jornada del']").click();
  await expect(page.getByRole("dialog").getByRole("radio", { name: "Media jornada" })).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel(/Cantidad de /)).toHaveCount(0);
  await expect(page.getByRole("dialog").getByLabel("Pago adicional por día (COP)")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  // Asistencia rápida en una fecha única
  const dia = fechaUnica();
  await page.goto(`/nomina/asistencia?fecha=${dia}`);
  const filaFijo = page.getByRole("listitem").filter({ hasText: fijo });
  await filaFijo.getByRole("radio", { name: "Media" }).click();
  await expect(filaFijo).toContainText("20.000");
  // El personal fijo no tiene botón de tareas ni lista de tareas en su jornada
  await expect(filaFijo.getByRole("button", { name: /Tareas y detalle/ })).toHaveCount(0);
  // Destajo: 3 cestas de "Cortada de Durazno" (10.000) + 5.000 adicional = 35.000
  const filaDestajo = page.getByRole("listitem").filter({ hasText: destajo });
  await filaDestajo.getByRole("button", { name: `Tareas y detalle de ${destajo}` }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Cantidad de Cortada de Durazno").fill("3");
  await dialogo.getByLabel("Pago adicional por día (COP)").fill("5.000");
  await expect(dialogo.getByTestId("ganado-hoy")).toHaveText("COP $ 35.000");
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(filaDestajo).toContainText("35.000");

  // Abono de 10.000 ese día → se le deben 25.000
  await page.goto(urlDestajo);
  await page.getByRole("button", { name: "Abonar" }).click();
  await page.fill("input[name=monto]", "10.000");
  await page.fill("input[name=fecha]", dia);
  await page.getByRole("button", { name: "Registrar abono" }).click();
  await expect(page.getByText("Abono de COP $ 10.000 registrado.")).toBeVisible();
  await expect(page.getByTestId("saldo-empleado")).toHaveText("COP $ 25.000");

  // Periodo de ese día: resumen, cierre con pago, recibo
  await page.goto("/nomina/periodos");
  await page.getByLabel("Desde").fill(dia);
  await page.getByLabel("Hasta").fill(dia);
  await page.getByRole("button", { name: "Crear periodo" }).click();
  await expect(page).toHaveURL(/\/nomina\/periodos\/\d+$/);
  const urlPeriodo = page.url();
  await expect(page.getByRole("row", { name: new RegExp(destajo) })).toContainText("25.000");
  await expect(page.getByRole("row", { name: new RegExp(fijo) })).toContainText("20.000");
  await page.getByRole("button", { name: "Cerrar periodo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar periodo" }).click();
  await expect(page.getByText(/Periodo cerrado y pagado/)).toBeVisible();
  await expect(page.getByText("Cerrado", { exact: true })).toBeVisible();

  await page.goto(`${urlPeriodo}/recibos`);
  await expect(page.getByText("RECIBO DE NÓMINA").first()).toBeVisible();
  await expect(page.getByText(/Cortada de Durazno × 3/)).toBeVisible();
  const excel = await page.request.get(`${urlPeriodo}/excel`);
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");

  // Saldo en 0 y el día quedó bloqueado
  await page.goto(urlDestajo);
  await expect(page.getByTestId("saldo-empleado")).toHaveText("COP $ 0");
  await page.goto(`/nomina/asistencia?fecha=${dia}`);
  await expect(page.getByText("Esta fecha está en un periodo cerrado.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: fijo }).getByRole("radio", { name: "No" })).toBeDisabled();

  // Reabrir con motivo: se quita el pago y vuelve a deber
  await page.goto(urlPeriodo);
  await page.getByRole("button", { name: "Reabrir" }).click();
  await page.getByLabel("Motivo").fill("Corrección de prueba");
  await page.getByRole("alertdialog").getByRole("button", { name: "Reabrir" }).click();
  await expect(page.getByText("Periodo reabierto.")).toBeVisible();
  await page.goto(urlDestajo);
  await expect(page.getByTestId("saldo-empleado")).toHaveText("COP $ 25.000");
});
