/**
 * Siluetas de frutas (línea fina, caja de 100×100) para la marca de agua de la factura.
 * Se usan igual en la hoja de pantalla (SVG) y en el PDF (react-pdf).
 */
export type Figura =
  | { tipo: "path"; d: string }
  | { tipo: "circulo"; cx: number; cy: number; r: number }
  | { tipo: "elipse"; cx: number; cy: number; rx: number; ry: number };

const c = (cx: number, cy: number, r: number): Figura => ({ tipo: "circulo", cx, cy, r });
const p = (d: string): Figura => ({ tipo: "path", d });

export const FRUTAS: Record<string, Figura[]> = {
  fresa: [
    p("M50 92 C30 80 18 60 20 42 C22 30 34 26 50 30 C66 26 78 30 80 42 C82 60 70 80 50 92 Z"),
    p("M50 30 L38 20 L46 25 L44 12 L50 22 L56 12 L54 25 L62 20 Z"),
    c(38, 46, 1.6), c(50, 44, 1.6), c(62, 46, 1.6), c(34, 58, 1.6), c(46, 58, 1.6), c(58, 58, 1.6), c(68, 58, 1.6),
    c(40, 70, 1.6), c(52, 70, 1.6), c(62, 70, 1.6), c(47, 81, 1.6), c(55, 81, 1.6),
  ],
  pina: [
    { tipo: "elipse", cx: 50, cy: 64, rx: 22, ry: 28 },
    p("M33 46 L62 90 M38 39 L70 82 M45 36 L72 68 M30 58 L50 91 M67 46 L38 90 M62 39 L30 82 M55 36 L28 68 M70 58 L50 91"),
    p("M50 36 L41 10 L47 24 L50 4 L53 24 L59 10 Z M47 34 L30 16 L44 28 M53 34 L70 16 L56 28"),
  ],
  mango: [
    p("M30 72 C18 52 28 26 54 22 C78 19 90 40 82 61 C74 82 44 90 30 72 Z"),
    p("M54 22 L53 14"),
    p("M53 15 C58 6 70 3 80 6 C73 13 64 16 53 15 Z"),
  ],
  guanabana: [
    p("M50 92 C28 90 20 68 23 50 C26 32 38 22 50 22 C63 22 75 32 77 50 C80 70 72 90 50 92 Z"),
    p("M36 40 l-3 -2 M48 34 l0 -3 M62 40 l3 -2 M30 56 l-3 0 M44 52 l-2 -2 M58 52 l2 -2 M72 56 l3 0 M36 70 l-3 2 M50 66 l0 3 M64 70 l3 2 M44 82 l-2 2 M58 82 l2 2"),
    p("M50 22 C46 12 37 7 29 9 C33 17 41 22 50 22 Z"),
  ],
  parchita: [
    c(50, 56, 32),
    p("M50 24 C51 18 54 13 59 10"),
    p("M50 24 C44 18 36 16 30 18 C36 22 44 24 50 24 Z"),
    c(40, 50, 1.8), c(52, 44, 1.8), c(62, 54, 1.8), c(46, 64, 1.8), c(58, 70, 1.8), c(36, 66, 1.8),
  ],
  mora: [
    c(42, 50, 9), c(58, 50, 9), c(50, 63, 9), c(35, 64, 9), c(65, 64, 9), c(43, 77, 9), c(57, 77, 9), c(50, 88, 7),
    p("M50 41 L42 28 L49 35 L50 22 L51 35 L58 28 Z"),
  ],
};

/** Dónde va cada fruta en la hoja (porcentajes del ancho/alto) y su giro. */
export const DISPOSICION: { fruta: keyof typeof FRUTAS; x: number; y: number; tam: number; giro: number }[] = [
  { fruta: "guanabana", x: 4, y: 14, tam: 20, giro: -12 },
  { fruta: "fresa", x: 74, y: 20, tam: 15, giro: 14 },
  { fruta: "pina", x: 40, y: 38, tam: 22, giro: 6 },
  { fruta: "mango", x: 6, y: 60, tam: 18, giro: 18 },
  { fruta: "parchita", x: 72, y: 58, tam: 17, giro: -8 },
  { fruta: "mora", x: 38, y: 80, tam: 14, giro: -16 },
];

/** Opacidad de la marca de agua: muy tenue para no estorbar la lectura. */
export const OPACIDAD_MARCA = 0.07;
