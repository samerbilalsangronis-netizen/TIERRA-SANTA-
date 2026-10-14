import { z } from "zod";
import { fechaISO, idOpcional, numeroLibre, textoOpcional } from "@/lib/esquemas-comunes";

export const esquemaCliente = z.object({
  id: idOpcional,
  numero: numeroLibre().refine((n) => n === null || (Number.isInteger(n) && n > 0), "Número entero mayor a 0"),
  nombre: z.string().trim().min(2, "Escribe el nombre o razón social").max(150),
  documento: textoOpcional(30),
  telefono: textoOpcional(40),
  direccion: textoOpcional(250),
  correo: z.union([z.literal(""), z.email("Correo no válido")]).optional().transform((v) => v || null),
  notas: textoOpcional(1000),
  limite_credito: numeroLibre().refine((n) => n === null || n >= 0, "No puede ser negativo"),
  limite_moneda: z.string().optional().transform((v) => v || null),
  activo: z.boolean(),
});
export type DatosCliente = z.input<typeof esquemaCliente>;

export const esquemaFacturaExterna = z.object({
  id: idOpcional,
  cliente_id: z.coerce.number<number | string>().int().positive(),
  numero_externo: z.string().trim().min(1, "Escribe el número de la factura").max(40),
  fecha: fechaISO,
  moneda: z.string().length(3),
  total: numeroLibre().refine((n) => n !== null && n > 0, "Escribe el monto"),
  observaciones: textoOpcional(300),
  soporte_url: z.union([z.literal(""), z.url("URL no válida")]).optional().transform((v) => v || null),
  soporte_path: z.string().optional().transform((v) => v || null),
});
export type DatosFacturaExterna = z.input<typeof esquemaFacturaExterna>;

export const esquemaPago = z
  .object({
    id: idOpcional,
    cliente_id: z.coerce.number<number | string>().int().positive(),
    fecha: fechaISO,
    moneda: z.string().length(3),
    monto: numeroLibre().refine((n) => n !== null && n > 0, "El monto recibido debe ser mayor a 0"),
    metodo_id: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined || v === "" ? null : Number(v))),
    referencia: textoOpcional(80),
    nota: textoOpcional(300),
    aplicaciones: z.array(z.object({ factura_id: z.number().int().positive(), monto: z.number().positive() })),
  })
  .refine((d) => d.aplicaciones.reduce((a, x) => a + x.monto, 0) <= (d.monto ?? 0) + 0.001, {
    path: ["monto"], message: "Lo aplicado a facturas supera el monto recibido",
  });
export type DatosPago = z.input<typeof esquemaPago>;

export const esquemaEmpaque = z
  .object({
    id: idOpcional,
    cliente_id: z.coerce.number<number | string>().int().positive(),
    fecha: fechaISO,
    retiradas: numeroLibre().transform((n) => Math.trunc(n ?? 0)).refine((n) => n >= 0, "No puede ser negativo"),
    devueltas: numeroLibre().transform((n) => Math.trunc(n ?? 0)).refine((n) => n >= 0, "No puede ser negativo"),
    nota: textoOpcional(300),
  })
  .refine((d) => d.retiradas + d.devueltas > 0, { path: ["retiradas"], message: "Indica cajas retiradas o devueltas" });
export type DatosEmpaque = z.input<typeof esquemaEmpaque>;
