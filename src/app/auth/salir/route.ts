import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Cierra la sesión (usado cuando el usuario fue bloqueado o venció mientras navegaba). */
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const motivo = request.nextUrl.searchParams.get("motivo");
  const url = new URL("/", request.url);
  if (motivo) url.searchParams.set("motivo", motivo);
  return NextResponse.redirect(url);
}
