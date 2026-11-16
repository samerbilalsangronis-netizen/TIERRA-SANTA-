import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/revision", workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3010", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] } },
  projects: [{ name: "pc", use: { viewport: { width: 1366, height: 860 } } }, { name: "telefono", use: { viewport: { width: 390, height: 844 }, isMobile: true } }],
  webServer: [
    { command: "node tests/revision/servidor-falso.mjs", url: "http://127.0.0.1:54321/rest/v1/monedas", reuseExistingServer: false },
    { command: "npm run dev -- --port 3010 --hostname 127.0.0.1", url: "http://127.0.0.1:3010", reuseExistingServer: false, timeout: 120000,
      env: { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "clave-ficticia-local" } },
  ],
});
