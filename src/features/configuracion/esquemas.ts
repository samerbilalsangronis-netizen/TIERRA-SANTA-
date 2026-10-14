import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";

const textoOpcional = z.string().trim().max(500, "Máximo 500 caracteres").default("");

export const esquemaEmpresa = z.object({
  razon_social: z.string().trim().min(2, "Escribe la razón social").max(150),
  rif: textoOpcional,
  direccion: textoOpcional,
  telefonos: textoOpcional,
  correo: z.union([z.literal(""), z.email("Correo no válido")]).default(""),
  pie_factura: z.string().trim().max(1000).default(""),
  texto_legal: z.string().trim().max(2000).default(""),
  titulo_documento: z.string().trim().min(2, "Indica el título").max(40),
  iva_pct: z.coerce.number<string | number>().min(0, "Mínimo 0").max(100, "Máximo 100"),
  moneda_defecto: z.string().length(3),
  factura_prefijo: z.string().trim().max(10, "Máximo 10 caracteres").default(""),
  factura_numero_inicial: z.coerce.number<string | number>().int("Debe ser entero").min(1, "Mínimo 1"),
  stock_insuficiente: z.enum(["advertir", "bloquear"]),
  cambio_moneda_con_pagos: z.enum(["convertir", "bloquear"]),
  roles_editan_factura: z.array(z.enum(ROLES)).min(1, "Al menos un rol"),
  entregas_suman_inventario: z.boolean(),
  entregas_ubicacion_id: z.coerce.number<string | number>().int().positive().nullable(),
  lotes_activos: z.boolean(),
  nomina_periodicidad: z.enum(["semanal", "quincenal", "mensual"]),
  nomina_inicio_semana: z.coerce.number<string | number>().int().min(0).max(6),
});
export type DatosEmpresa = z.input<typeof esquemaEmpresa>;
export type DatosEmpresaValidos = z.output<typeof esquemaEmpresa>;

export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
