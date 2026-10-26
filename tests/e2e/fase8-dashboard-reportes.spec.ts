import { expect, test } from "@playwright/test";
import { entrarComoAdmin } from "./utilidades";

test("dashboard: periodos con comparación, productos vendidos, rendimiento semanal y gráficos", async ({ page }) => {
  await entrarComoAdmin(page);
  await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible();
  const cifras = page.getByRole("region", { name: "Cifras del periodo" });
  await expect(cifras.getByText("Ventas USD")).toBeVisible();
  await expect(cifras.getByText("Productos vendidos")).toBeVisible();
  await expect(cifras.getByText("Nómina")).toBeVisible(); // admin

  // Rendimiento semanal: 12 semanas, cambia entre bolsas y monto
  const rendimiento = page.getByRole("region", { name: "Rendimiento semanal" });
  await expect(rendimiento.getByText(/Esta semana/)).toBeVisible();
  await rendimiento.getByRole("radio", { name: /Monto/ }).click();
  await expect(rendimiento.getByText(/Esta semana .*(USD|COP)/)).toBeVisible();

  // Cambiar periodo y moneda
  await page.getByRole("button", { name: "Semana pasada" }).click();
  await expect(page).toHaveURL(/p=semana_pasada/);
  await page.getByRole("button", { name: "Rango" }).click();
  await page.getByLabel("Desde").fill("2026-01-01");
  await expect(page).toHaveURL(/desde=2026-01-01/);
  await page.getByRole("radio", { name: "COP" }).first().click();
  await expect(page).toHaveURL(/moneda=COP/);
  await expect(page.getByRole("region", { name: "Ventas por día (COP)" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("reportes: cada reporte en pantalla y en Excel", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/reportes");
  for (const [ruta, titulo] of [
    ["ventas-producto", "VENTAS POR PRODUCTO"], ["ventas-cliente", "VENTAS POR CLIENTE"], ["libro-facturas", "LIBRO DE FACTURAS"],
    ["fruta-recibida", "FRUTA RECIBIDA"], ["saldos-proveedores", "SALDOS DE PROVEEDORES"], ["compras-proveedor", "COMPRAS POR PROVEEDOR"], ["produccion", "PRODUCCIÓN DIARIA"], ["cajas-cestas", "CAJAS Y CESTAS"],
  ]) {
    await page.goto(`/reportes/${ruta}?p=rango&desde=2026-01-01&hasta=2026-12-31`);
    await expect(page.getByText(titulo)).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    const r = await page.request.get(`/reportes/${ruta}/excel?desde=2026-01-01&hasta=2026-12-31&moneda=USD`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("spreadsheetml");
  }
  // Ventas por producto tiene filas y total
  await page.goto("/reportes/ventas-producto?p=rango&desde=2026-01-01&hasta=2026-12-31&moneda=USD");
  await expect(page.getByRole("columnheader", { name: "Producto" })).toBeVisible();
  // Un solo reporte con dólares y pesos: sin selector de moneda y un monto por moneda
  await expect(page.getByRole("radiogroup", { name: "Moneda de los gráficos" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Monto USD" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Monto COP" })).toBeVisible();
});

test("fruta recibida: se suma de las entregas y se filtra por proveedor", async ({ page }) => {
  await entrarComoAdmin(page);
  const nombre = `Finca Reporte ${Date.now().toString(36).slice(-5)}`;
  await page.goto("/proveedores");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  await page.fill("input[name=nombre]", nombre);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/proveedores\/\d+/);
  const id = page.url().split("/").pop()!.split("?")[0];
  // Entrega por kilo: 120 kg de mora con 4 kg de merma
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  const opcion = page.locator("select[name=producto_id] option", { hasText: "Mora" }).first();
  await page.selectOption("select[name=producto_id]", (await opcion.getAttribute("value"))!);
  await page.getByRole("radio", { name: "Por kilo" }).click();
  await page.fill("input[name=kg_total]", "120");
  await page.fill("input[name=precio]", "3.000");
  await page.fill("input[name=merma]", "4");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Entrega registrada.").first()).toBeVisible();

  await page.goto("/reportes/fruta-recibida?p=hoy");
  await page.getByLabel("Proveedor").selectOption(id);
  await expect(page).toHaveURL(new RegExp(`proveedor=${id}`));
  await expect(page.getByText(`Proveedor: ${nombre}`)).toBeVisible();
  const fila = page.getByRole("row", { name: /Mora/ });
  await expect(fila).toContainText("120");
  await expect(fila).toContainText("116");
  await expect(fila).toContainText("100,0 %");
  const r = await page.request.get(`/reportes/fruta-recibida/excel?desde=2026-01-01&hasta=2026-12-31&proveedor=${id}`);
  expect(r.status()).toBe(200);
});

test("saldos de proveedores: por fruta y eligiendo proveedores", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/reportes/saldos-proveedores");
  await expect(page.getByText("SALDOS DE PROVEEDORES")).toBeVisible();
  await expect(page.getByRole("button", { name: "Este mes" })).toHaveCount(0); // no usa periodo
  const fruta = page.getByLabel("Fruta que traen");
  const valor = await fruta.locator("option", { hasText: "Mora" }).first().getAttribute("value");
  await fruta.selectOption(valor!);
  await expect(page).toHaveURL(new RegExp(`rubro=${valor}`));
  await expect(page.getByText(/Proveedores que traen Mora/)).toBeVisible();
  // Elegir solo dos
  await page.getByRole("button", { name: "Elegir proveedores" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Ninguno" }).click();
  const casillas = dialogo.getByRole("checkbox");
  await casillas.nth(0).click();
  await casillas.nth(1).click();
  await dialogo.getByRole("button", { name: "Ver reporte" }).click();
  await expect(page).toHaveURL(/sel=\d+(,|%2C)\d+/);
  await expect(page.getByRole("button", { name: "2 proveedores elegidos" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tfoot")).toContainText("Total (2 proveedores)");
  const excel = await page.request.get(`/reportes/saldos-proveedores/excel?${new URL(page.url()).searchParams}`);
  expect(excel.status()).toBe(200);
});
