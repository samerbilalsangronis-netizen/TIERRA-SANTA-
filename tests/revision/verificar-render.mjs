// Comprueba las páginas reales de Next con la API sintética; no requiere navegador ni base real.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const procesos = [];
const iniciar = (cmd, args, env = {}) => {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  procesos.push(p); p.stderr.on("data", (d) => process.stderr.write(d));
  p.stdout.on("data", () => {}); return p;
};
const esperar = async (url) => {
  for (let i = 0; i < 240; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* servidor arrancando */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No arrancó ${url}`);
};
try {
  iniciar(process.execPath, ["tests/revision/servidor-falso.mjs"]);
  await esperar("http://127.0.0.1:54321/rest/v1/monedas");
  iniciar(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3010", "--hostname", "127.0.0.1"], {
    VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "clave-ficticia-local",
  });
  await esperar("http://127.0.0.1:3010");
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const id = "00000000-0000-4000-8000-000000000001", exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: id, aud: "authenticated", role: "authenticated", exp })}.firma-ficticia`;
  const cookie = "sb-127-auth-token=base64-" + enc({ access_token, refresh_token: "local", token_type: "bearer", expires_at: exp, expires_in: 3600, user: { id, email: "revision@tierrasanta.test" } });
  for (const [ruta, esperado] of [
    ["/proveedores/1?entregasPagina=25", "Entrega 1"],
    ["/proveedores/1?seccion=abonos&abonosPagina=3", "Abono 1"],
    ["/nomina/1?pestana=abonos&pagina=13", "Pago 1"],
    ["/gastos?p=rango&desde=2026-11-01&hasta=2026-11-30&pagina=45", "2205"],
  ]) {
    const r = await fetch(`http://127.0.0.1:3010${ruta}`, { headers: { cookie } });
    const html = await r.text();
    assert.equal(r.status, 200, ruta);
    assert.ok(html.includes("Vista previa de revisión"), `${ruta}: falta aviso de solo consulta`);
    assert.ok(html.includes(esperado), `${ruta}: no aparece el registro antiguo esperado`);
    assert.ok(html.includes("Anterior"), `${ruta}: falta paginación`);
    process.stdout.write(`OK ${ruta}\n`);
  }
} finally {
  for (const p of procesos.reverse()) p.kill("SIGTERM");
}
