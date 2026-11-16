import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/env";

const RUTAS_PUBLICAS = ["/", "/auth"];

/** Refresca la sesión en cada petición y protege las rutas privadas. */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigurado()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // No poner lógica entre createServerClient y getClaims (recomendación de Supabase).
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((r) => (r === "/" ? ruta === "/" : ruta.startsWith(r)));

  if (!conSesion && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("siguiente", ruta);
    return NextResponse.redirect(url);
  }
  if (conSesion && ruta === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
