import { describe, expect, it } from "vitest";
import { rangoPeriodo, variacion } from "@/lib/periodos";

describe("Periodos del dashboard", () => {
  const hoy = "2026-10-14"; // miércoles
  it("hoy, semana y semana pasada (lunes a domingo)", () => {
    expect(rangoPeriodo("hoy", hoy)).toEqual({ actual: { desde: hoy, hasta: hoy }, anterior: { desde: "2026-10-13", hasta: "2026-10-13" } });
    expect(rangoPeriodo("semana", hoy)).toEqual({ actual: { desde: "2026-10-12", hasta: hoy }, anterior: { desde: "2026-10-05", hasta: "2026-10-07" } });
    expect(rangoPeriodo("semana_pasada", hoy)).toEqual({ actual: { desde: "2026-10-05", hasta: "2026-10-11" }, anterior: { desde: "2026-09-28", hasta: "2026-10-04" } });
  });
  it("este mes se compara con los mismos días del mes anterior", () => {
    expect(rangoPeriodo("mes", hoy)).toEqual({ actual: { desde: "2026-10-01", hasta: hoy }, anterior: { desde: "2026-09-01", hasta: "2026-09-14" } });
    expect(rangoPeriodo("mes", "2026-03-31").anterior).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoPeriodo("mes_pasado", hoy)).toEqual({ actual: { desde: "2026-09-01", hasta: "2026-09-30" }, anterior: { desde: "2026-08-01", hasta: "2026-08-31" } });
  });
  it("rango libre: el anterior tiene la misma cantidad de días", () => {
    expect(rangoPeriodo("rango", hoy, { desde: "2026-10-01", hasta: "2026-10-10" }).anterior).toEqual({ desde: "2026-09-21", hasta: "2026-09-30" });
  });
  it("variación", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(50, 0)).toBeNull();
  });
});
