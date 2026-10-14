import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|logo-tierra-santa.png|logo-tierra-santa-negro.png|marca/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
