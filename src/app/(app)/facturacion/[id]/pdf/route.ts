import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPerfil, evaluarAcceso } from "@/lib/auth/sesion";
import { numeroFactura } from "@/lib/facturas";
import { urlLogo } from "@/lib/empresa";
import { cargarEmpresaDocumento, cargarFactura } from "@/features/facturacion/datos";
import { PdfFactura } from "@/features/facturacion/pdf-factura";

/** Logo para el PDF: el subido en Configuración o el logo negro por defecto. */
async function logoPdf(logoPath: string | null) {
  if (logoPath) return urlLogo(logoPath);
  try {
    return { data: await readFile(path.join(process.cwd(), "public", "logo-tierra-santa-negro.png")), format: "png" as const };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: RouteContext<"/facturacion/[id]/pdf">) {
  const perfil = await obtenerPerfil();
  if (!perfil || !evaluarAcceso(perfil).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Factura no válida" }, { status: 400 });
  const [factura, empresa] = await Promise.all([cargarFactura(id), cargarEmpresaDocumento()]);
  if (!factura || !empresa) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  const documento = createElement(PdfFactura, { factura, empresa, logo: await logoPdf(empresa.logo_path) }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(documento);
  const nombre = `${empresa.titulo_documento}-${numeroFactura(factura, empresa.factura_prefijo)}`.replace(/[^\w.-]+/g, "_");
  const descargar = request.nextUrl.searchParams.get("descargar") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
