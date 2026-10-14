import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo. Requieren:
 *  - Supabase local corriendo (`npx supabase start`) con las migraciones aplicadas
 *  - .env.local apuntando a ese Supabase
 *  - Un admin creado: E2E_ADMIN_CORREO / E2E_ADMIN_CLAVE (por defecto admin@tierrasanta.test / Clave2026)
 * Uso: npm run test:e2e   (se prueba en PC y en teléfono)
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "es-VE",
    timezoneId: "America/Caracas",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "pc", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
    { name: "telefono", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
