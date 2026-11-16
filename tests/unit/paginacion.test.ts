import { describe, expect, it } from "vitest";
import { leerPagina, leerTodos, numeroPagina } from "@/lib/paginacion";

function consulta(total: number, maximo: number, conConteo = true) {
  const filas = Array.from({ length: total }, (_, id) => ({ id, monto: 0.1 }));
  return async (d: number, h: number) => ({ data: filas.slice(d, Math.min(h + 1, d + maximo)), count: conConteo ? total : null, error: null });
}

describe("historiales completos con límite de API", () => {
  it("recupera 1.205 filas aunque el servidor solo entregue 17 por petición", async () => {
    const filas = await leerTodos(consulta(1205, 17));
    expect(filas).toHaveLength(1205);
    expect(new Set(filas.map((x) => x.id)).size).toBe(1205);
    expect(filas.at(-1)?.id).toBe(1204);
  });
  it("sin conteo tampoco confunde una respuesta corta con el fin", async () => {
    expect(await leerTodos(consulta(601, 13, false))).toHaveLength(601);
  });
  it("una página antigua se completa incluso con un máximo menor que 50", async () => {
    const r = await leerPagina(consulta(1205, 17), 25);
    expect(r.total).toBe(1205);
    expect(r.filas.map((x) => x.id)).toEqual([1200, 1201, 1202, 1203, 1204]);
    const segunda = await leerPagina(consulta(1205, 17), 2);
    expect(segunda.filas).toHaveLength(50);
    expect(segunda.filas[0].id).toBe(50);
    expect(segunda.filas.at(-1)?.id).toBe(99);
  });
  it("ajusta una página que dejó de existir después de borrar o filtrar", async () => {
    const r = await leerPagina(consulta(51, 17), 999);
    expect(r.pagina).toBe(2);
    expect(r.filas.map((x) => x.id)).toEqual([50]);
  });
  it("un historial vacío no necesita páginas inexistentes", async () => {
    expect(await leerPagina(consulta(0, 17), 5)).toMatchObject({ pagina: 1, total: 0, filas: [] });
  });
  it("no transforma un fallo intermedio en totales parciales", async () => {
    await expect(leerTodos(async (d, h) => d > 0
      ? { data: null, count: 1205, error: { message: "Sin conexión" } }
      : consulta(1205, 17)(d, h))).rejects.toThrow("Sin conexión");
    await expect(leerPagina(async () => ({ data: [], count: 10, error: null }), 1)).rejects.toThrow("cambió");
  });
  it("rechaza páginas inválidas", () => {
    for (const n of ["-1", "1.5", "Infinity", "abc", undefined, ["2", "3"]]) expect(numeroPagina(n)).toBe(1);
  });
});
