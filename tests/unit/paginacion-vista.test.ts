import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Paginacion } from "@/components/comunes/paginacion";
vi.mock("next/navigation", () => ({
  usePathname: () => "/proveedores/1",
  useSearchParams: () => new URLSearchParams("moneda=COP&desde=2026-01-01&seccion=entregas&abonosPagina=2"),
}));
vi.mock("next/link", () => ({ default: ({ href, children, className }: { href: string; children: ReactNode; className: string }) => createElement("a", { href, className }, children) }));
const render = (total: number, pagina = 1) => renderToStaticMarkup(createElement(Paginacion, { total, pagina, porPagina: 50, parametro: "entregasPagina" }));
describe("controles claros para historiales de distinto tamaño", () => {
  it.each([0, 6, 49, 50])("con %i registros muestra página única, sin flechas engañosas", (total) => {
    const html = render(total);
    expect(html).toContain("Página única");
    expect(html).not.toContain("Siguiente");
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("<a");
  });
  it.each([51, 121, 1205])("con %i registros hay enlace activo hacia la segunda página", (total) => {
    const html = render(total);
    expect(html).toContain("Siguiente");
    expect(html).toContain("entregasPagina=2");
    expect(html).toContain("moneda=COP");
    expect(html).toContain("abonosPagina=2");
    expect(html).not.toContain("Página única");
  });
  it("en la última página deshabilita siguiente sin dejar un enlace navegable", () => {
    const html = render(121, 3);
    expect(html).toContain("entregasPagina=2");
    expect(html).not.toContain("entregasPagina=4");
    expect(html).toContain('aria-disabled="true"');
  });
});
