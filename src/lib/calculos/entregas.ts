import { Decimal, dec, r2, type Monto } from "@/lib/dinero";

/** Modo de compra de una entrega (columna modo_pesaje). */
export type ModoCompra = "KG" | "UNIDAD" | "FIJO" | "VARIABLE";
/** @deprecated usar ModoCompra */
export type ModoPesaje = ModoCompra;

export const MODOS_COMPRA: { valor: ModoCompra; titulo: string; corto: string }[] = [
  { valor: "KG", titulo: "Por kilo", corto: "kg" },
  { valor: "UNIDAD", titulo: "Por unidad", corto: "und" },
  { valor: "FIJO", titulo: "Por cesta", corto: "cesta" },
];
export const NOMBRE_MODO: Record<ModoCompra, string> = {
  KG: "Por kilo", UNIDAD: "Por unidad", FIJO: "Por cesta", VARIABLE: "Precio total (sistema anterior)",
};

export type EntradaEntrega = {
  modo: ModoCompra;
  kgPorCesta?: Monto | null;
  cestas?: Monto | null;
  kgTotal?: Monto | null;   // KG y VARIABLE
  unidades?: Monto | null;  // UNIDAD
  precio: Monto;            // KG: por kilo · UNIDAD: por unidad · FIJO: por cesta · VARIABLE: total
  merma?: Monto | null;     // kg (o unidades dañadas en UNIDAD)
};

export type ResultadoEntrega = {
  kgTotal: Decimal; precioKg: Decimal; descMerma: Decimal; total: Decimal; pesoNeto: Decimal;
};

/**
 * Cálculo de una entrega (idéntico a public.calcular_entrega en la BD):
 *  KG:       total = round(kg × precio) − round(merma × precio)
 *  UNIDAD:   total = round(unidades × precio) − round(dañadas × precio)
 *  FIJO:     kg = cestas × kg_por_cesta; total = round(cestas × precio_cesta) − round(merma × precio_cesta / kg_por_cesta)
 *  VARIABLE: total = precio − round(merma × precio / kg_total)   (solo datos del sistema anterior)
 */
export function calcularEntrega(e: EntradaEntrega): ResultadoEntrega {
  const precio = dec(e.precio);
  const merma = dec(e.merma);
  switch (e.modo) {
    case "KG": {
      const kg = dec(e.kgTotal);
      if (kg.lte(0)) throw new Error("Indica los kilos recibidos.");
      if (merma.gt(kg)) throw new Error("La merma no puede superar los kilos recibidos.");
      const desc = r2(merma.times(precio));
      return { kgTotal: kg, precioKg: precio, descMerma: desc, total: r2(kg.times(precio)).minus(desc), pesoNeto: kg.minus(merma) };
    }
    case "UNIDAD": {
      const und = dec(e.unidades);
      if (und.lte(0)) throw new Error("Indica las unidades recibidas.");
      if (merma.gt(und)) throw new Error("Las unidades dañadas no pueden superar las recibidas.");
      const desc = r2(merma.times(precio));
      return { kgTotal: new Decimal(0), precioKg: precio, descMerma: desc, total: r2(und.times(precio)).minus(desc), pesoNeto: new Decimal(0) };
    }
    case "FIJO": {
      const kgc = dec(e.kgPorCesta);
      if (kgc.lte(0)) throw new Error("La compra por cesta requiere kg por cesta mayor a 0.");
      const cestas = dec(e.cestas);
      const kgTotal = cestas.times(kgc).toDecimalPlaces(3);
      if (merma.gt(kgTotal)) throw new Error("La merma no puede superar el peso total.");
      const desc = r2(merma.times(precio).div(kgc));
      return { kgTotal, precioKg: precio.div(kgc).toDecimalPlaces(4), descMerma: desc, total: r2(cestas.times(precio)).minus(desc), pesoNeto: kgTotal.minus(merma) };
    }
    case "VARIABLE": {
      const kgTotal = dec(e.kgTotal);
      if (kgTotal.lte(0)) throw new Error("Indica el total de kg.");
      if (merma.gt(kgTotal)) throw new Error("La merma no puede superar el peso total.");
      const desc = r2(merma.times(precio).div(kgTotal));
      return { kgTotal, precioKg: precio.div(kgTotal).toDecimalPlaces(4), descMerma: desc, total: precio.minus(desc), pesoNeto: kgTotal.minus(merma) };
    }
  }
}
