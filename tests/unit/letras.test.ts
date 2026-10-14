import { describe, expect, it } from "vitest";
import { enteroEnLetras, montoEnLetras } from "@/lib/numeros-a-letras";

describe("números en letras", () => {
  it.each([
    [0, "CERO"], [1, "UNO"], [15, "QUINCE"], [21, "VEINTIUNO"], [30, "TREINTA"], [45, "CUARENTA Y CINCO"],
    [100, "CIEN"], [101, "CIENTO UNO"], [999, "NOVECIENTOS NOVENTA Y NUEVE"], [1000, "MIL"],
    [1250, "MIL DOSCIENTOS CINCUENTA"], [21000, "VEINTIÚN MIL"], [101000, "CIENTO UN MIL"],
    [1_000_000, "UN MILLÓN"], [2_500_000, "DOS MILLONES QUINIENTOS MIL"], [21_000_001, "VEINTIÚN MILLONES UNO"],
  ])("%d → %s", (n, texto) => expect(enteroEnLetras(n)).toBe(texto));

  it("montos con moneda", () => {
    expect(montoEnLetras("1250.5", "USD")).toBe("MIL DOSCIENTOS CINCUENTA DÓLARES CON 50/100");
    expect(montoEnLetras(1, "USD")).toBe("UN DÓLAR CON 00/100");
    expect(montoEnLetras(21, "USD")).toBe("VEINTIÚN DÓLARES CON 00/100");
    expect(montoEnLetras(350000, "COP")).toBe("TRESCIENTOS CINCUENTA MIL PESOS");
    expect(montoEnLetras(1_000_000, "COP")).toBe("UN MILLÓN DE PESOS");
    expect(montoEnLetras("0.99", "VES")).toBe("CERO BOLÍVARES CON 99/100");
  });
});
