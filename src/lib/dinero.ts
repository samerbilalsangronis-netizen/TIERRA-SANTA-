import Decimal from "decimal.js";

// Aritmética decimal exacta para dinero (nunca float). En BD todo es numeric(14,2).
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
export type Monto = Decimal.Value;

export type CodigoMoneda = "USD" | "COP" | "VES" | (string & {});

export const MONEDAS_BASE: Record<string, { simbolo: string; decimales: number; nombre: string }> = {
  USD: { simbolo: "$", decimales: 2, nombre: "Dólares" },
  COP: { simbolo: "$", decimales: 0, nombre: "Pesos colombianos" },
  VES: { simbolo: "Bs", decimales: 2, nombre: "Bolívares" },
};

export function dec(v: Monto | null | undefined): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  try {
    return new Decimal(v);
  } catch {
    return new Decimal(0);
  }
}

/** Redondeo a 2 decimales (ROUND_HALF_UP, igual que round() de Postgres para numeric). */
export function r2(v: Monto): Decimal {
  return dec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumar(valores: Monto[]): Decimal {
  return valores.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

/** Formatea un número con punto de miles y coma decimal: 1234567.5 → "1.234.567,50" */
export function formatearNumero(v: Monto | null | undefined, decimales = 2): string {
  const d = dec(v);
  const negativo = d.isNegative() && !d.isZero();
  const [entero, fraccion] = d.abs().toFixed(decimales, Decimal.ROUND_HALF_UP).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}${conMiles}${fraccion ? `,${fraccion}` : ""}`;
}

/** Cantidades (kg, unidades): hasta 3 decimales sin ceros sobrantes. */
export function formatearCantidad(v: Monto | null | undefined, maxDecimales = 3): string {
  const d = dec(v).toDecimalPlaces(maxDecimales);
  const decs = Math.min(d.decimalPlaces(), maxDecimales);
  return formatearNumero(d, decs);
}

/** "USD $ 1.250,00" · "COP $ 350.000" · "VES Bs 1.250,00" */
export function formatearMonto(v: Monto | null | undefined, moneda: CodigoMoneda, opciones?: { sinCodigo?: boolean }) {
  const info = MONEDAS_BASE[moneda] ?? { simbolo: "$", decimales: 2 };
  const d = dec(v);
  const texto = `${info.simbolo} ${formatearNumero(d.abs(), info.decimales)}`;
  const conCodigo = opciones?.sinCodigo ? texto : `${moneda} ${texto}`;
  return d.isNegative() && !d.isZero() ? `-${conCodigo}` : conCodigo;
}

/** Interpreta lo que el usuario escribe: "1.250,50", "1250.50", "1250,5" → Decimal (null si no es número). */
export function parsearMonto(texto: string): Decimal | null {
  let t = texto.trim().replace(/\s|\$|USD|COP|VES|Bs/gi, "");
  if (!t) return null;
  const tieneComa = t.includes(",");
  const tienePunto = t.includes(".");
  if (tieneComa && tienePunto) {
    // El último separador es el decimal
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (tieneComa) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (tienePunto) {
    // "350.000" (miles) vs "2.5" (decimal): si hay grupos exactos de 3 tras puntos, son miles
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return new Decimal(t);
}
