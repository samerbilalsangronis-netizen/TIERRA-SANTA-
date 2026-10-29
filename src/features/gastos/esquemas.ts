import { z } from "zod";
import { fechaISO, idOpcional, numeroLibre, textoOpcional } from "@/lib/esquemas-comunes";

const idNulo = z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined || v === "" ? null : Number(v)));

export const esquemaGasto = z.object({
  id: idOpcional,
  fecha: fechaISO,
  concepto_id: z.coerce.number<number | string>().int().positive("Elige el concepto"),
  cantidad: numeroLibre().refine((n) => n === null || n > 0, "Debe ser mayor a 0"),
  unidad: z.string().optional().transform((v) => v || null),
  monto: numeroLibre().refine((n) => n !== null && n > 0, "Escribe el monto"),
  moneda: z.string().length(3),
  metodo_id: idNulo,
  lugar: textoOpcional(120),
  pagado_por: textoOpcional(80),
  nota: textoOpcional(300),
  foto_path: z.string().optional().transform((v) => v || null),
});
export type DatosGasto = z.input<typeof esquemaGasto>;

export const esquemaConcepto = z.object({
  id: idOpcional,
  nombre: z.string().trim().min(2, "Escribe el nombre").max(80),
  categoria_id: z.coerce.number<number | string>().int().positive("Elige la categoría"),
  unidad: z.string().min(1, "Elige la unidad"),
  activo: z.boolean(),
});
export type DatosConcepto = z.input<typeof esquemaConcepto>;
