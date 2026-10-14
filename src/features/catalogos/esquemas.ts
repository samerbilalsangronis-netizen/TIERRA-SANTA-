import { z } from "zod";
import { parsearMonto } from "@/lib/dinero";

const texto = (max = 100) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const textoOpc = (max = 300) => texto(max).transform((v) => (v === "" ? null : v));
const numero = (msg = "Número no válido") =>
  z.union([z.number(), z.string()]).transform((v, ctx) => {
    if (typeof v === "number") return v;
    if (v.trim() === "") return null;
    const d = parsearMonto(v);
    if (!d) { ctx.addIssue({ code: "custom", message: msg }); return z.NEVER; }
    return d.toNumber();
  });
const idOpcional = z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined || v === "" ? undefined : Number(v)));

export const TIPOS_PRODUCTO = [
  ["terminado", "Se vende (bolsa de pulpa) · facturas e inventario"],
  ["materia_prima", "Se compra (fruta) · entregas de proveedores"],
  ["ambos", "Se compra y se vende igual"],
] as const;

export const esquemaProducto = z
  .object({
    id: idOpcional,
    codigo: numero().refine((n) => n !== null && Number.isInteger(n) && n > 0, "Código entero mayor a 0"),
    nombre: texto(80).min(2, "Escribe el nombre"),
    emoji: texto(8).transform((v) => (v === "" ? null : v)),
    unidad: z.string().min(1, "Elige la unidad"),
    tipo: z.enum(["materia_prima", "terminado", "ambos"]),
    categoria: z.enum(["fruta", "insumo"]),
    modo_pesaje: z.enum(["KG", "UNIDAD", "FIJO", "VARIABLE"]),
    kg_por_cesta: numero().refine((n) => n === null || n > 0, "Debe ser mayor a 0"),
    stock_minimo: numero().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativo"),
    activo: z.boolean(),
    notas: textoOpc(500),
  })
  .superRefine((d, ctx) => {
    if (d.modo_pesaje === "FIJO" && !d.kg_por_cesta) {
      ctx.addIssue({ code: "custom", path: ["kg_por_cesta"], message: "La compra por cesta necesita los kg por cesta" });
    }
  });
export type DatosProducto = z.input<typeof esquemaProducto>;

export const esquemaUnidad = z.object({
  nuevo: z.boolean(),
  codigo: texto(20).toLowerCase().regex(/^[a-z0-9_]{1,20}$/, "Solo minúsculas, números o _ (ej. kg, cesta)"),
  nombre: texto(40).min(1, "Escribe el nombre"),
  plural: texto(40).min(1, "Escribe el plural"),
  activa: z.boolean(),
});
export type DatosUnidad = z.input<typeof esquemaUnidad>;

export const esquemaUbicacion = z.object({
  id: idOpcional,
  nombre: texto(60).min(2, "Escribe el nombre"),
  descripcion: textoOpc(200),
  es_cuarto_frio: z.boolean(),
  predeterminada: z.boolean(),
  activa: z.boolean(),
});
export type DatosUbicacion = z.input<typeof esquemaUbicacion>;

export const esquemaMoneda = z.object({
  nuevo: z.boolean(),
  codigo: texto(3).toUpperCase().regex(/^[A-Z]{3}$/, "Código de 3 letras (ej. USD)"),
  nombre: texto(40).min(2, "Escribe el nombre"),
  simbolo: texto(4).min(1, "Escribe el símbolo"),
  decimales: numero().refine((n) => n !== null && Number.isInteger(n) && n >= 0 && n <= 4, "Entre 0 y 4"),
  activa: z.boolean(),
  orden: numero().transform((n) => n ?? 0),
});
export type DatosMoneda = z.input<typeof esquemaMoneda>;

export const esquemaTasa = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    moneda_origen: z.string().length(3),
    moneda_destino: z.string().length(3),
    tasa: numero().refine((n) => n !== null && n > 0, "La tasa debe ser mayor a 0"),
    nota: textoOpc(200),
  })
  .refine((d) => d.moneda_origen !== d.moneda_destino, { path: ["moneda_destino"], message: "Debe ser distinta" });
export type DatosTasa = z.input<typeof esquemaTasa>;

export const esquemaMetodoPago = z.object({
  id: idOpcional,
  nombre: texto(40).min(2, "Escribe el nombre"),
  activo: z.boolean(),
  orden: numero().transform((n) => n ?? 0),
});
export type DatosMetodoPago = z.input<typeof esquemaMetodoPago>;

export const esquemaTarea = z.object({
  id: idOpcional,
  emoji: texto(8).transform((v) => (v === "" ? null : v)),
  nombre: texto(80).min(2, "Escribe el nombre de la tarea"),
  valor: numero().refine((n) => n !== null && n >= 0, "Escribe el valor en COP"),
  unidad: texto(20).min(1, "Ej. cesta, kg"),
  activa: z.boolean(),
  orden: numero().transform((n) => n ?? 0),
});
export type DatosTarea = z.input<typeof esquemaTarea>;
