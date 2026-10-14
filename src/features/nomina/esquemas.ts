import { z } from "zod";
import { fechaISO, idOpcional, numeroLibre, textoOpcional } from "@/lib/esquemas-comunes";

export const esquemaEmpleado = z.object({
  id: idOpcional,
  nombre: z.string().trim().min(2, "Escribe el nombre").max(120),
  cedula: textoOpcional(30),
  telefono: textoOpcional(40),
  cargo: textoOpcional(60),
  tipo: z.enum(["fijo", "destajo"]),
  tarifa_dia: numeroLibre().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativo"),
  fecha_ingreso: z.union([z.literal(""), fechaISO]).optional().transform((v) => v || null),
  activo: z.boolean(),
  notas: textoOpcional(500),
}).refine((d) => d.tipo === "destajo" || d.tarifa_dia > 0, { path: ["tarifa_dia"], message: "Escribe cuánto gana por día" });
export type DatosEmpleado = z.input<typeof esquemaEmpleado>;

export const esquemaJornada = z.object({
  empleado_id: z.number().int().positive(),
  fecha: fechaISO,
  estado: z.enum(["asistio", "media", "produccion", "no"]),
  justificada: z.boolean(),
  pago_adicional: numeroLibre().transform((n) => n ?? 0).refine((n) => n >= 0, "No puede ser negativo"),
  nota: textoOpcional(300),
  // valor_unitario: el precio que ya tenía la tarea ese día (si no viene, se usa el precio actual)
  tareas: z.array(z.object({ tarea_id: z.number().int().positive(), cantidad: numeroLibre(), valor_unitario: z.number().nonnegative().optional() }))
    .transform((xs) => xs.filter((x) => (x.cantidad ?? 0) > 0).map((x) => ({ tarea_id: x.tarea_id, cantidad: x.cantidad!, ...(x.valor_unitario !== undefined ? { valor_unitario: x.valor_unitario } : {}) }))),
});
export type DatosJornada = z.input<typeof esquemaJornada>;

export const esquemaAbono = z.object({
  id: idOpcional,
  empleado_id: z.coerce.number<number | string>().int().positive(),
  fecha: fechaISO,
  monto: numeroLibre().refine((n) => n !== null && n > 0, "Escribe el monto"),
  entregado_por: textoOpcional(80),
  nota: textoOpcional(300),
});
export type DatosAbono = z.input<typeof esquemaAbono>;

export const esquemaPeriodo = z.object({ desde: fechaISO, hasta: fechaISO })
  .refine((d) => d.hasta >= d.desde, { path: ["hasta"], message: "La fecha final debe ser después de la inicial" });
