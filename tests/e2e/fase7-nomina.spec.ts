import { expect, test, type Page } from "@playwright/test";
import { entrarComoAdmin, sufijo } from "./utilidades";

/** Fecha única por corrida (lejos de hoy, para no mezclarse con otras pruebas). */
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

test("nómina: jornadas por tarea y fijas, asistencia rápida, adelanto, pago, panel y reporte desde el último pago, pagar a los fijos", async ({ page }) => {
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

  const urlFijo = await crearEmpleado(page, fijo, "fijo", "40.000");
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

  // Adelanto de 10.000 ese día → se le deben 25.000
  await page.goto(urlDestajo);
  await expect(page.getByTestId("ultimo-pago")).toHaveText("Sin pagos");
  await page.getByRole("button", { name: "Adelanto" }).click();
  await page.fill("input[name=monto]", "10.000");
  await page.fill("input[name=fecha]", dia);
  await page.getByRole("button", { name: "Registrar adelanto" }).click();
  await expect(page.getByText("Adelanto de COP $ 10.000 registrado.")).toBeVisible();
  await expect(page.getByTestId("saldo-empleado")).toHaveText("COP $ 25.000");

  // Panel: lo ganado desde el último pago (nunca se le pagó), días del mes y cestas por tarea
  await page.goto(`${urlDestajo}?pestana=panel&mes=${dia.slice(0, 7)}`);
  await expect(page.getByText("Ganado desde el último pago").locator("..")).toContainText("35.000");
  await expect(page.getByText("Adelantos desde el último pago").locator("..")).toContainText("10.000");
  await expect(page.getByTestId("dias-mes")).toHaveText("1");
  await expect(page.getByRole("listitem").filter({ hasText: "Cortada de Durazno" })).toContainText("3");
  await expect(page.getByText("Medias jornadas")).toHaveCount(0); // eso es solo para fijos

  // Pagar: propone todo lo que se le debe
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  await expect(page.locator("input[name=monto]")).toHaveValue("25.000");
  await page.fill("input[name=fecha]", dia);
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByText("Pago de COP $ 25.000 registrado.")).toBeVisible();
  await expect(page.getByTestId("saldo-empleado")).toHaveText("COP $ 0");
  await expect(page.getByTestId("ultimo-pago")).toContainText(dia.split("-").reverse().join("/"));

  // Reporte: por defecto desde el último pago (no hay nada nuevo) y "este mes" muestra la jornada
  await page.goto(`${urlDestajo}?pestana=reporte`);
  await expect(page.getByRole("button", { name: "Desde el último pago" })).toBeVisible();
  await expect(page.getByText("Sin jornadas en estas fechas.")).toBeVisible();
  await expect(page.getByTestId("a-pagar-reporte")).toHaveText("COP $ 0");
  await page.goto(`${urlDestajo}?pestana=reporte&desde=${dia}&hasta=${dia}`);
  await expect(page.getByRole("cell", { name: /Cortada de Durazno × 3/ })).toBeVisible();

  // Pagar a los fijos: pago parcial (15.000 de 20.000) → le quedan 5.000 acumulados
  await page.goto("/nomina");
  await page.getByRole("button", { name: "Pagar a los fijos" }).click();
  const ventana = page.getByRole("dialog");
  await ventana.getByRole("button", { name: "Ninguno" }).click();
  await ventana.getByRole("checkbox", { name: `Pagar a ${fijo}` }).click();
  await ventana.getByLabel(`Monto para ${fijo}`).fill("15.000");
  await ventana.locator("input[type=date]").fill(dia);
  await ventana.getByRole("button", { name: "Registrar pagos" }).click();
  await expect(page.getByText(/1 pago registrado/)).toBeVisible();
  await page.goto(urlFijo);
  await expect(page.getByTestId("saldo-empleado")).toHaveText("COP $ 5.000");
  await page.goto(`${urlFijo}?pestana=abonos`);
  await expect(page.getByText(/^Pago ·/)).toBeVisible();
});
