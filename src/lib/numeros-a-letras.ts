import { dec, type Monto } from "@/lib/dinero";

const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS",
  "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100;
  let texto = CENTENAS[c];
  if (r > 0) {
    const resto = r < 30 ? UNIDADES[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` Y ${UNIDADES[r % 10]}` : ""}`;
    texto = texto ? `${texto} ${resto}` : resto;
  }
  return texto;
}

/** Número entero en letras (español): 1250 → "MIL DOSCIENTOS CINCUENTA". */
export function enteroEnLetras(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  n = Math.floor(n);
  if (n === 0) return "CERO";
  const partes: string[] = [];
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLÓN" : `${apocopar(enteroEnLetras(millones))} MILLONES`);
  }
  if (miles > 0) partes.push(miles === 1 ? "MIL" : `${apocopar(menorQueMil(miles))} MIL`);
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(" ");
}

/** "VEINTIUNO" → "VEINTIÚN", "CIENTO UNO" → "CIENTO UN" (delante de MIL / MILLONES / la moneda). */
function apocopar(t: string): string {
  return t.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
}

const NOMBRE_MONEDA: Record<string, { singular: string; plural: string }> = {
  USD: { singular: "DÓLAR", plural: "DÓLARES" },
  COP: { singular: "PESO", plural: "PESOS" },
  VES: { singular: "BOLÍVAR", plural: "BOLÍVARES" },
};

/**
 * Monto en letras para la factura:
 *  1250.5 USD → "MIL DOSCIENTOS CINCUENTA DÓLARES CON 50/100"
 *  350000 COP → "TRESCIENTOS CINCUENTA MIL PESOS"
 */
export function montoEnLetras(valor: Monto, moneda: string): string {
  const d = dec(valor).abs().toDecimalPlaces(2);
  const entero = d.floor().toNumber();
  const centimos = d.minus(d.floor()).times(100).round().toNumber();
  const m = NOMBRE_MONEDA[moneda] ?? { singular: moneda, plural: moneda };
  let letras = entero === 1 ? "UN" : apocopar(enteroEnLetras(entero));
  // "UN MILLÓN DE DÓLARES", "DOS MILLONES DE PESOS"
  if (entero > 0 && entero % 1_000_000 === 0) letras += " DE";
  const texto = `${letras} ${entero === 1 ? m.singular : m.plural}`;
  if (moneda === "COP" && centimos === 0) return texto;
  return `${texto} CON ${String(centimos).padStart(2, "0")}/100`;
}
