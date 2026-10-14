import { describe, expect, it } from "vitest";
import { formatearCantidad, formatearMonto, formatearNumero, parsearMonto } from "@/lib/dinero";
import { formatearFecha, hoyISO, parsearFecha } from "@/lib/fechas";
import { evaluarAcceso } from "@/lib/auth/acceso";

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
  it("solo entran usuarios ACTIVOS", () => {
    expect(evaluarAcceso({ estado: "ACTIVO" })).toEqual({ ok: true });
    expect(evaluarAcceso({ estado: "BLOQUEADO" })).toEqual({ ok: false, motivo: "bloqueado" });
    expect(evaluarAcceso({ estado: "INACTIVO" })).toEqual({ ok: false, motivo: "inactivo" });
  });
});

import { esquemaProducto, esquemaTasa } from "@/features/catalogos/esquemas";

describe("Esquemas de catálogos", () => {
  it("interpreta números escritos a mano", () => {
    const t = esquemaTasa.parse({ fecha: "2026-10-14", moneda_origen: "USD", moneda_destino: "COP", tasa: "4.000", nota: "" });
    expect(t.tasa).toBe(4000);
    expect(esquemaTasa.parse({ fecha: "2026-10-14", moneda_origen: "COP", moneda_destino: "USD", tasa: "0,00025", nota: "" }).tasa).toBe(0.00025);
  });
  it("la compra por cesta exige kg por cesta", () => {
    const base = { codigo: "10", nombre: "Lulo", emoji: "", unidad: "kg", tipo: "ambos", categoria: "fruta", modo_pesaje: "FIJO", stock_minimo: "", activo: true, notas: "" } as const;
    expect(esquemaProducto.safeParse({ ...base, kg_por_cesta: "" }).success).toBe(false);
    expect(esquemaProducto.parse({ ...base, kg_por_cesta: "12,5" }).kg_por_cesta).toBe(12.5);
    expect(esquemaProducto.parse({ ...base, modo_pesaje: "KG", kg_por_cesta: "" }).kg_por_cesta).toBeNull();
  });
});
