/** Los dos grupos de personal, en el orden en que se muestran. */
export const GRUPOS_PERSONAL = [
  { tipo: "fijo", titulo: "Personal fijo", corto: "Fijo" },
  { tipo: "destajo", titulo: "Por destajo", corto: "Destajo" },
] as const;

export type TipoEmpleado = (typeof GRUPOS_PERSONAL)[number]["tipo"];

export const nombreTipo = (tipo: string) => (tipo === "fijo" ? "Fijo" : "Destajo");

/** Separa una lista en fijos y por destajo (manteniendo el orden de cada uno). */
export function separarPorTipo<T extends { tipo: string }>(filas: T[]) {
  return GRUPOS_PERSONAL.map((g) => ({ ...g, filas: filas.filter((f) => (g.tipo === "fijo" ? f.tipo === "fijo" : f.tipo !== "fijo")) }));
}
