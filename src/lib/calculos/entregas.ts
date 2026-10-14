import { Decimal, dec, r2, type Monto } from "@/lib/dinero";

export type ModoPesaje = "FIJO" | "VARIABLE";

export type EntradaEntrega = {
  modo: ModoPesaje;
  kgPorCesta?: Monto | null;
  cestas?: Monto | null;
  kgTotal?: Monto | null; // solo VARIABLE
  precio: Monto; // FIJO: precio por cesta · VARIABLE: precio total de la entrega
  merma?: Monto | null; // kg
};

export type ResultadoEntrega = {
  kgTotal: Decimal; precioKg: Decimal; descMerma: Decimal; total: Decimal; pesoNeto: Decimal;
};

/**
 * Fórmulas del sistema anterior (idénticas a public.calcular_entrega en la BD):
 *  FIJO:     kg_total = cestas × kg_por_cesta; precio_kg = precio_cesta / kg_por_cesta;
 *            desc_merma = merma × precio_kg;  total = cestas × precio_cesta − desc_merma
 *  VARIABLE: precio_kg = precio / kg_total; desc_merma = merma × precio_kg; total = precio − desc_merma
 *  peso_neto = kg_total − merma
 */
export function calcularEntrega(e: EntradaEntrega): ResultadoEntrega {
  const precio = dec(e.precio);
  const merma = dec(e.merma);
  let kgTotal: Decimal, precioKg: Decimal, descMerma: Decimal, total: Decimal;
  if (e.modo === "FIJO") {
    const kgc = dec(e.kgPorCesta);
    if (kgc.lte(0)) throw new Error("El rubro FIJO requiere kg por cesta mayor a 0.");
    const cestas = dec(e.cestas);
    kgTotal = cestas.times(kgc).toDecimalPlaces(3);
    precioKg = precio.div(kgc).toDecimalPlaces(4);
    descMerma = r2(merma.times(precio).div(kgc));
    total = r2(cestas.times(precio)).minus(descMerma);
  } else {
    kgTotal = dec(e.kgTotal);
    if (kgTotal.lte(0)) throw new Error("El rubro VARIABLE requiere el total de kg mayor a 0.");
    precioKg = precio.div(kgTotal).toDecimalPlaces(4);
    descMerma = r2(merma.times(precio).div(kgTotal));
    total = precio.minus(descMerma);
  }
  if (merma.gt(kgTotal)) throw new Error("La merma no puede superar el peso total.");
  return { kgTotal, precioKg, descMerma, total, pesoNeto: kgTotal.minus(merma) };
}
