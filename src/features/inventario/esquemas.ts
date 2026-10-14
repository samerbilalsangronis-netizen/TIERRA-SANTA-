import { z } from "zod";
import { fechaISO, numeroLibre, textoOpcional } from "@/lib/esquemas-comunes";

const id = (msg: string) => z.coerce.number<number | string>({ error: msg }).int().positive(msg);
const cantidad = numeroLibre().refine((n) => n !== null && n > 0, "Cantidad mayor a 0");

export const esquemaProduccion = z.object({
  fecha: fechaISO,
  ubicacion_id: id("Elige dónde se guarda"),
  responsable: textoOpcional(80),
  nota: textoOpcional(300),
  items: z.array(z.object({ producto_id: z.number().int().positive(), cantidad: numeroLibre() }))
    .transform((xs) => xs.filter((x) => (x.cantidad ?? 0) > 0).map((x) => ({ producto_id: x.producto_id, cantidad: x.cantidad! })))
    .refine((xs) => xs.length > 0, "Escribe la cantidad de al menos un producto"),
});
export type DatosProduccion = z.input<typeof esquemaProduccion>;

export const esquemaMovimiento = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("merma"), producto_id: id("Elige el producto"), ubicacion_id: id("Elige la ubicación"),
    cantidad, motivo: z.string().trim().min(3, "Escribe qué pasó").max(300) }),
  z.object({ tipo: z.literal("traslado"), producto_id: id("Elige el producto"), ubicacion_id: id("Elige el origen"),
    destino_id: id("Elige el destino"), cantidad, motivo: textoOpcional(300) }),
  z.object({ tipo: z.literal("ajuste"), producto_id: id("Elige el producto"), ubicacion_id: id("Elige la ubicación"),
    conteo: numeroLibre().refine((n) => n !== null && n >= 0, "Escribe lo que contaste"), motivo: z.string().trim().min(3, "Escribe el motivo").max(300) }),
]);
export type DatosMovimiento = z.input<typeof esquemaMovimiento>;
