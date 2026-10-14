import { describe, expect, it } from "vitest";
import { formatearCantidad, formatearMonto, formatearNumero, parsearMonto } from "@/lib/dinero";
import { formatearFecha, hoyISO, parsearFecha } from "@/lib/fechas";
import { evaluarAcceso, diasParaVencer } from "@/lib/auth/acceso";

describe("Formato de montos", () => {
  it("muestra la moneda con miles con punto y decimales con coma", () => {
    expect(formatearMonto(1250, "USD")).toBe("USD $ 1.250,00");
    expect(formatearMonto(350000, "COP")).toBe("COP $ 350.000");
    expect(formatearMonto(-12.5, "USD")).toBe("-USD $ 12,50");
    expect(formatearNumero(1234567.891, 2)).toBe("1.234.567,89");
    expect(formatearCantidad(12.5)).toBe("12,5");
  });
  it("interpreta lo que escribe el usuario", () => {
    expect(parsearMonto("1.250,50")?.toNumber()).toBe(1250.5);
    expect(parsearMonto("1250.50")?.toNumber()).toBe(1250.5);
    expect(parsearMonto("350.000")?.toNumber()).toBe(350000);
    expect(parsearMonto("2.5")?.toNumber()).toBe(2.5);
    expect(parsearMonto("COP $ 1.000.000")?.toNumber()).toBe(1000000);
    expect(parsearMonto("abc")).toBeNull();
  });
});

describe("Fechas", () => {
  it("dd/MM/yyyy", () => {
    expect(formatearFecha("2026-10-14")).toBe("14/10/2026");
    expect(parsearFecha("1/2/2026")).toBe("2026-02-01");
    expect(parsearFecha("31/02/2026")).toBeNull();
  });
  it("hoy en Caracas (UTC-4)", () => {
    expect(hoyISO(new Date("2026-10-15T02:00:00Z"))).toBe("2026-10-14");
  });
});

describe("Acceso de usuarios", () => {
  it("rechaza bloqueados, inactivos y vencidos", () => {
    expect(evaluarAcceso({ estado: "BLOQUEADO", vence_el: null })).toEqual({ ok: false, motivo: "bloqueado" });
    expect(evaluarAcceso({ estado: "INACTIVO", vence_el: null })).toEqual({ ok: false, motivo: "inactivo" });
    expect(evaluarAcceso({ estado: "ACTIVO", vence_el: "2026-10-13" }, "2026-10-14")).toMatchObject({ ok: false, motivo: "vencido" });
    expect(evaluarAcceso({ estado: "ACTIVO", vence_el: "2026-10-14" }, "2026-10-14")).toEqual({ ok: true });
  });
  it("días para vencer", () => {
    expect(diasParaVencer("2026-10-20", "2026-10-14")).toBe(6);
    expect(diasParaVencer(null)).toBeNull();
  });
});
