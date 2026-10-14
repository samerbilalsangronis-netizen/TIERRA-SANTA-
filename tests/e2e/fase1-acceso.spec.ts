import { expect, test } from "@playwright/test";
import { ADMIN, alertaFormulario, entrarComoAdmin, iniciarSesion, sufijo } from "./utilidades";

test("pantalla de inicio: logo y error de contraseña", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main img").first()).toBeVisible();
  await iniciarSesion(page, ADMIN.usuario, "clave-incorrecta");
  await expect(alertaFormulario(page)).toHaveText("Usuario o contraseña incorrectos.");
});

test("rutas privadas redirigen al inicio y la sesión salta al dashboard", async ({ page }) => {
  await page.goto("/configuracion/usuarios");
  await expect(page).toHaveURL(/siguiente=%2Fconfiguracion%2Fusuarios/);
  await page.fill("#usuario", ADMIN.usuario.toUpperCase()); // no distingue mayúsculas
  await page.fill("#clave", ADMIN.clave);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/configuracion\/usuarios/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("usuario: crear, primer inicio, permisos, bloqueo y vencimiento", async ({ browser }) => {
  const admin = await browser.newPage();
  await entrarComoAdmin(admin);
  const usuario = `op.${sufijo()}`;

  await admin.goto("/configuracion/usuarios");
  await admin.getByRole("button", { name: "Nuevo usuario" }).click();
  await admin.fill("input[name=usuario]", usuario);
  await admin.fill("input[name=nombre]", "Operador de Prueba");
  await admin.selectOption("select[name=rol]", "operador");
  await admin.fill("input[name=clave]", "Temporal123");
  await admin.getByRole("button", { name: "Crear usuario" }).click();
  await expect(admin.getByText(`Usuario ${usuario} creado.`)).toBeVisible();

  const op = await browser.newPage();
  await iniciarSesion(op, usuario, "Temporal123");
  await expect(op).toHaveURL(/\/auth\/cambiar-clave/);
  await op.fill("input[name=clave]", "NuevaClave9");
  await op.fill("input[name=confirmar]", "NuevaClave9");
  await op.getByRole("button", { name: "Guardar" }).click();
  await expect(op).toHaveURL(/\/dashboard/);

  await op.goto("/nomina");
  await expect(op).toHaveURL(/\/sin-permiso/);

  await admin.reload();
  await admin.getByRole("button", { name: `Acciones de ${usuario}` }).first().click();
  await admin.getByRole("menuitem", { name: "Bloquear" }).click();
  await expect(admin.getByText("Usuario bloqueado.")).toBeVisible();
  await op.goto("/dashboard");
  await expect(op).toHaveURL(/motivo=bloqueado/);
  await iniciarSesion(op, usuario, "NuevaClave9");
  await expect(alertaFormulario(op)).toContainText("BLOQUEADO");

  await admin.getByRole("button", { name: `Acciones de ${usuario}` }).first().click();
  await admin.getByRole("menuitem", { name: "Activar" }).click();
  await expect(admin.getByText("Usuario activado.")).toBeVisible();
  await admin.getByRole("button", { name: `Acciones de ${usuario}` }).first().click();
  await admin.getByRole("menuitem", { name: "Editar" }).click();
  await admin.fill("input[name=vence_el]", "2026-01-01");
  await admin.getByRole("button", { name: "Guardar" }).click();
  await expect(admin.getByText("Usuario actualizado.")).toBeVisible();
  await iniciarSesion(op, usuario, "NuevaClave9");
  await expect(alertaFormulario(op)).toHaveText("Tu suscripción venció el 01/01/2026.");
  await admin.reload();
  await expect(admin.getByRole("row", { name: new RegExp(usuario) }).getByText("BLOQUEADO")).toBeVisible();
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
