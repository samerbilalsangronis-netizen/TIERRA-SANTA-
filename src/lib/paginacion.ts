/** Lecturas por lotes: no confundir una respuesta recortada por la API con el fin del historial. */
export type ConsultaPagina<T> = (desde: number, hasta: number) => PromiseLike<{
  data: T[] | null; error: { message: string } | null; count?: number | null;
}>;
export const POR_PAGINA = 50;
export type InfoPagina = { pagina: number; total: number; porPagina: number };
export function numeroPagina(valor: string | string[] | undefined): number {
  if (Array.isArray(valor)) return 1;
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}

export async function leerTodos<T>(consultar: ConsultaPagina<T>): Promise<T[]> {
  const filas: T[] = [];
  for (;;) {
    const { data, error, count } = await consultar(filas.length, filas.length + 499);
    if (error) throw new Error(`No se pudo cargar el historial: ${error.message}`);
    if (!data?.length) {
      if (count != null && filas.length < count) throw new Error("El historial cambió durante la consulta. Vuelve a cargarlo.");
      return filas;
    }
    filas.push(...data);
    if (count != null && filas.length >= count) return filas;
    // Incluso una página corta puede ser el máximo del servidor. Seguir hasta el final.
  }
}

export async function leerPagina<T>(consultar: ConsultaPagina<T>, solicitada: number, porPagina = POR_PAGINA) {
  // Obtener primero una página válida evita el 416 de PostgREST cuando el filtro
  // o una eliminación hacen que la página pedida ya no exista.
  let r = await consultar(0, porPagina - 1);
  if (r.error) throw new Error(`No se pudo cargar el historial: ${r.error.message}`);
  if (r.count == null) throw new Error("No se pudo obtener el número de movimientos.");
  const total = r.count;
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(numeroPagina(String(solicitada)), ultima);
  const inicio = (pagina - 1) * porPagina;
  if (pagina > 1) {
    r = await consultar(inicio, inicio + porPagina - 1);
    if (r.error) throw new Error(`No se pudo cargar el historial: ${r.error.message}`);
  }
  const filas = [...(r.data ?? [])];
  const esperadas = Math.min(porPagina, Math.max(0, total - inicio));
  while (filas.length < esperadas) {
    const siguiente = await consultar(inicio + filas.length, inicio + esperadas - 1);
    if (siguiente.error) throw new Error(`No se pudo cargar el historial: ${siguiente.error.message}`);
    if (!siguiente.data?.length) throw new Error("El historial cambió durante la consulta. Vuelve a cargarlo.");
    filas.push(...siguiente.data);
  }
  return { filas, pagina, total, porPagina };
}

export function infoPagina(p: InfoPagina): InfoPagina {
  return { pagina: p.pagina, total: p.total, porPagina: p.porPagina };
}
