/**
 * Crea (o promueve) el primer usuario administrador.
 * Uso:
 *   npx tsx --env-file=.env.local scripts/crear-admin.ts <usuario> <contraseña> ["Nombre completo"] [correo]
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

const [usuarioArg, clave, nombre = "Administrador", correo] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!usuarioArg || !clave) throw new Error('Uso: crear-admin.ts <usuario> <contraseña> ["Nombre"] [correo]');
  if (!url || !servicio) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  const usuario = usuarioArg.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) throw new Error("Usuario inválido (3-40: minúsculas, números, . _ -).");
  if (clave.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const sb = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existente } = await sb.from("profiles").select("id").eq("usuario", usuario).maybeSingle();
  if (existente) {
    await sb.auth.admin.updateUserById(existente.id, { password: clave });
    await sb.from("profiles").update({ rol: "admin", estado: "ACTIVO", vence_el: null }).eq("id", existente.id);
    console.log(`✔ Usuario "${usuario}" ya existía: ahora es ADMIN, ACTIVO y con la contraseña indicada.`);
    return;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email: correo ?? `${usuario}@usuarios.tierrasanta.local`,
    password: clave,
    email_confirm: true,
    user_metadata: { usuario, nombre, rol: "admin" },
  });
  if (error) throw error;
  console.log(`✔ Administrador "${usuario}" creado (id ${data.user?.id}).`);
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
