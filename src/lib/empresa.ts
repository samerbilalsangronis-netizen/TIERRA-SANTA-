import "server-only";
import { SUPABASE_URL } from "@/lib/env";

/** Logo oficial (alas + monograma TS). Blanco para fondos oscuros, negro para papel y modo claro. */
export const LOGO_POR_DEFECTO = "/logo-tierra-santa.png";
export const LOGO_POR_DEFECTO_NEGRO = "/logo-tierra-santa-negro.png";

/** URL pública del logo guardado en el bucket "empresa" (o el logo por defecto). */
export function urlLogo(logoPath: string | null | undefined): string {
  if (!logoPath || !SUPABASE_URL) return LOGO_POR_DEFECTO;
  return `${SUPABASE_URL}/storage/v1/object/public/empresa/${logoPath}`;
}
