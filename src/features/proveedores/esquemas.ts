import { z } from "zod";
import { fechaISO, idOpcional, numeroLibre, textoOpcional } from "@/lib/esquemas-comunes";

export const esquemaProveedor = z.object({
  id: idOpcional,
  nombre: z.string().trim().min(2, "Escribe el nombre").max(120),
  documento: textoOpcional(30),
  telefono: textoOpcional(40),
  ubicacion: textoOpcional(120),
  moneda_habitual: z.string().length(3),
  tipo: z.enum(["fruta", "insumos", "ambos"]),
  notas: textoOpcional(1000),
  activo: z.boolean(),
});
export type DatosProveedor = z.input<typeof esquemaProveedor>;

export const esquemaEntrega = z
  .object({
    id: idOpcional,
    proveedor_id: z.coerce.number<number | string>().int().positive(),
    fecha: fechaISO,
    producto_id: z.coerce.number<number | string>().int().positive("Elige el rubro"),
    moneda: z.string().length(3),
    modo_pesaje: z.enum(["KG", "UNIDAD", "FIJO", "VARIABLE"]),
    unidades: numeroLibre().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativo"),
    cestas: numeroLibre().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativo"),
    kg_total: numeroLibre().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativo"),
    precio: numeroLibre().refine((n) => n !== null && n >= 0, "Escribe el precio"),
    merma: numeroLibre().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativa"),
    foto_url: z.union([z.literal(""), z.url("URL no válida")]).optional().transform((v) => v || null),
    foto_path: z.string().optional().transform((v) => v || null),
    nota: textoOpcional(300),
    anotar_cestas: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.modo_pesaje === "FIJO" && d.cestas <= 0 && d.kg_total <= 0) ctx.addIssue({ code: "custom", path: ["cestas"], message: "Indica las cestas o los kilos" });
    if ((d.modo_pesaje === "KG" || d.modo_pesaje === "VARIABLE") && d.kg_total <= 0) ctx.addIssue({ code: "custom", path: ["kg_total"], message: "Indica los kilos" });
    if (d.modo_pesaje === "UNIDAD" && d.unidades <= 0) ctx.addIssue({ code: "custom", path: ["unidades"], message: "Indica las unidades" });
    const bruto = d.modo_pesaje === "UNIDAD" ? d.unidades : d.modo_pesaje === "FIJO" && d.kg_total <= 0 ? Infinity : d.kg_total;
    if (d.merma > bruto) ctx.addIssue({ code: "custom", path: ["merma"], message: d.modo_pesaje === "UNIDAD" ? "No puede superar las unidades" : "No puede superar los kilos" });
  });
export type DatosEntrega = z.input<typeof esquemaEntrega>;

export const esquemaAbono = z.object({
  id: idOpcional,
  proveedor_id: z.coerce.number<number | string>().int().positive(),
  fecha: fechaISO,
  moneda: z.string().length(3),
  monto: numeroLibre().refine((n) => n !== null && n > 0, "El monto debe ser mayor a 0"),
  metodo_id: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined || v === "" ? null : Number(v))),
  referencia: textoOpcional(80),
  pagado_por: textoOpcional(80),
  nota: textoOpcional(300),
});
export type DatosAbono = z.input<typeof esquemaAbono>;

export const esquemaCestas = z
  .object({
    id: idOpcional,
    proveedor_id: z.coerce.number<number | string>().int().positive(),
    fecha: fechaISO,
    entregadas: numeroLibre().transform((n) => Math.trunc(n ?? 0)).refine((n) => n >= 0, "No puede ser negativo"),
    devueltas: numeroLibre().transform((n) => Math.trunc(n ?? 0)).refine((n) => n >= 0, "No puede ser negativo"),
    nota: textoOpcional(300),
  })
  .refine((d) => d.entregadas + d.devueltas > 0, { path: ["entregadas"], message: "Indica cestas entregadas o devueltas" });
export type DatosCestas = z.input<typeof esquemaCestas>;
