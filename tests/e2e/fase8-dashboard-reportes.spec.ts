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
    ["compras-proveedor", "COMPRAS POR PROVEEDOR"], ["produccion", "PRODUCCIÓN DIARIA"], ["cajas-cestas", "CAJAS Y CESTAS"],
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
});
