import { z } from "zod";
import { fechaISO, idOpcional, numeroLibre, textoOpcional } from "@/lib/esquemas-comunes";

const idNulo = z.union([z.number(), z.string(), z.null()]).optional()
  .transform((v) => (v === undefined || v === null || v === "" ? null : Number(v)));

export const esquemaLinea = z.object({
  producto_id: z.coerce.number<number | string>().int().positive("Elige el producto"),
  cantidad: numeroLibre().refine((n) => n !== null && n > 0, "Cantidad mayor a 0"),
  precio_unitario: numeroLibre().refine((n) => n !== null && n >= 0, "Escribe el precio"),
  aplica_iva: z.boolean(),
});

export const esquemaFactura = z.object({
  id: idOpcional,
  /** emitir = nueva o borrador → emitida · borrador = guardar sin emitir · editar = factura ya emitida */
  modo: z.enum(["emitir", "borrador", "editar"]),
  cliente_id: z.coerce.number<number | string>({ error: "Elige el cliente" }).int().positive("Elige el cliente"),
  fecha: fechaISO,
  moneda: z.string().length(3),
  condicion: z.enum(["contado", "credito"]),
  ubicacion_id: idNulo,
  observaciones: textoOpcional(500),
  iva_pct: numeroLibre().refine((n) => n !== null && n >= 0 && n <= 100, "IVA entre 0 y 100"),
  lineas: z.array(esquemaLinea).min(1, "Agrega al menos un producto"),
  cajas: numeroLibre().transform((n) => Math.trunc(n ?? 0)).refine((n) => n >= 0, "No puede ser negativo"),
  pago: z.object({
    monto: numeroLibre().refine((n) => n === null || n >= 0, "No puede ser negativo"),
    metodo_id: idNulo,
    referencia: textoOpcional(80),
  }),
  motivo: textoOpcional(300),
  tasa_conversion: numeroLibre().refine((n) => n === null || n > 0, "La tasa debe ser mayor a 0"),
});
export type DatosFactura = z.input<typeof esquemaFactura>;
