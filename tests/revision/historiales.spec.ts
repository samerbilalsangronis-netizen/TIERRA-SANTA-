import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const id = "00000000-0000-4000-8000-000000000001";
  const parte = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const access_token = `${parte({ alg: "HS256", typ: "JWT" })}.${parte({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.firma-ficticia`;
  const sesion = { access_token, refresh_token: "local", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user: { id, email: "revision@tierrasanta.test" } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${parte(sesion)}`, domain: "127.0.0.1", path: "/" }]);
});

test("proveedor: 1.205 entregas, última página, filtros y abonos conservan sección", async ({ page }) => {
  await page.goto("/proveedores/1");
  await expect(page.getByText("Vista previa de revisión", { exact: false })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Entregas (1205)" })).toBeVisible();
  await page.goto("/proveedores/1?entregasPagina=25");
  await expect(page.locator("body")).toContainText("Entrega 1");
  await expect(page.getByText("1.201–1.205 de 1.205")).toBeVisible();
  await page.getByRole("tab", { name: "Abonos (105)" }).click();
  await page.getByRole("link", { name: /Siguiente/ }).click();
  await expect(page.getByRole("tab", { name: "Abonos (105)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("51–100 de 105")).toBeVisible();
});

test("nómina: se puede consultar el pago más antiguo de 605", async ({ page }) => {
  await page.goto("/nomina/1?pestana=abonos&pagina=13");
  await expect(page.getByText("Pago 1", { exact: true })).toBeVisible();
  await expect(page.getByText("601–605 de 605")).toBeVisible();
});

test("gastos: cambiar de página no cambia los totales de 2.205 registros", async ({ page }) => {
  await page.goto("/gastos?p=rango&desde=2026-11-01&hasta=2026-11-30");
  await expect(page.getByText("Gastos registrados").locator("..")).toContainText("2205");
  const total = await page.getByText("Gastado COP").locator("..").textContent();
  await page.getByRole("link", { name: /Siguiente/ }).click();
  await expect(page.getByText("51–100 de 2.205")).toBeVisible();
  await expect(page.getByText("Gastado COP").locator("..")).toHaveText(total!);
  await expect(page.getByText("Gastos registrados").locator("..")).toContainText("2205");
  const ancho = await page.evaluate(() => ({ cuerpo: document.documentElement.scrollWidth, pantalla: innerWidth }));
  expect(ancho.cuerpo).toBeLessThanOrEqual(ancho.pantalla + 1);
});
