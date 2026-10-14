import { expect, test } from "@playwright/test";
import { ADMIN, alertaFormulario, entrarComoAdmin, iniciarSesion, sufijo } from "./utilidades";

test("pantalla de inicio: logo y error de contraseña", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main img").first()).toBeVisible();
  await iniciarSesion(page, ADMIN.correo, "clave-incorrecta");
  await expect(alertaFormulario(page)).toHaveText("Correo o contraseña incorrectos.");
});

test("rutas privadas redirigen al inicio y la sesión salta al dashboard", async ({ page }) => {
  await page.goto("/configuracion/usuarios");
  await expect(page).toHaveURL(/siguiente=%2Fconfiguracion%2Fusuarios/);
  await page.fill("#correo", ADMIN.correo.toUpperCase()); // no distingue mayúsculas
  await page.fill("#clave", ADMIN.clave);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/configuracion\/usuarios/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("usuario: crear, primer inicio, permisos y bloqueo", async ({ browser }) => {
  const admin = await browser.newPage();
  await entrarComoAdmin(admin);
  const correo = `op.${sufijo()}@tierrasanta.test`;

  await admin.goto("/configuracion/usuarios");
  await admin.getByRole("button", { name: "Nuevo usuario" }).click();
  await admin.fill("input[name=nombre]", "Operador de Prueba");
  await admin.fill("input[name=correo]", correo);
  await admin.selectOption("select[name=rol]", "operador");
  await admin.fill("input[name=clave]", "Temporal123");
  await admin.getByRole("button", { name: "Crear usuario" }).click();
  await expect(admin.getByText(`Usuario ${correo} creado.`)).toBeVisible();

  // Primer inicio: obliga a cambiar la contraseña
  const op = await browser.newPage();
  await iniciarSesion(op, correo, "Temporal123");
  await expect(op).toHaveURL(/\/auth\/cambiar-clave/);
  await op.fill("input[name=clave]", "NuevaClave9");
  await op.fill("input[name=confirmar]", "NuevaClave9");
  await op.getByRole("button", { name: "Guardar" }).click();
  await expect(op).toHaveURL(/\/dashboard/);

  // Permisos por rol
  await op.goto("/nomina");
  await expect(op).toHaveURL(/\/sin-permiso/);

  // Bloqueo: la sesión abierta se cierra y el login se rechaza
  await admin.reload();
  await admin.getByRole("button", { name: `Acciones de ${correo}` }).first().click();
  await admin.getByRole("menuitem", { name: "Bloquear" }).click();
  await expect(admin.getByText("Usuario bloqueado.")).toBeVisible();
  await op.goto("/dashboard");
  await expect(op).toHaveURL(/motivo=bloqueado/);
  await iniciarSesion(op, correo, "NuevaClave9");
  await expect(alertaFormulario(op)).toContainText("BLOQUEADO");

  // Reactivar
  await admin.getByRole("button", { name: `Acciones de ${correo}` }).first().click();
  await admin.getByRole("menuitem", { name: "Activar" }).click();
  await expect(admin.getByText("Usuario activado.")).toBeVisible();
  await iniciarSesion(op, correo, "NuevaClave9");
  await expect(op).toHaveURL(/\/dashboard/);
});

test("configuración de empresa con logo", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/configuracion/empresa");
  await page.setInputFiles("input[type=file]", "public/logo-tierra-santa.png");
  await expect(page.getByText("Logo actualizado.")).toBeVisible({ timeout: 15_000 });
  await page.fill("input[name=rif]", `J-${Date.now().toString().slice(-8)}-0`);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Configuración guardada/)).toBeVisible();
  await page.getByRole("button", { name: "Quitar" }).click();
  await page.getByRole("button", { name: "Quitar" }).last().click();
  await expect(page.getByText("Se restauró el logo por defecto.")).toBeVisible();
});
