import { z } from "zod";
import { ESTADOS_USUARIO, REGEX_USUARIO, ROLES } from "@/lib/auth/roles";
import { esquemaClave } from "@/features/auth/esquemas";

const fechaOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha no válida")
  .transform((v) => (v === "" ? null : v));

const correoOpcional = z
  .union([z.literal(""), z.email("Correo no válido")])
  .transform((v) => (v === "" ? null : v.toLowerCase()));

export const esquemaNuevoUsuario = z.object({
  usuario: z.string().trim().toLowerCase().regex(REGEX_USUARIO, "3 a 40 caracteres: letras minúsculas, números, punto, guion"),
  nombre: z.string().trim().min(2, "Escribe el nombre").max(100),
  correo: correoOpcional,
  rol: z.enum(ROLES),
  vence_el: fechaOpcional,
  clave: esquemaClave,
  debe_cambiar_clave: z.boolean(),
});
export type DatosNuevoUsuario = z.input<typeof esquemaNuevoUsuario>;

export const esquemaEditarUsuario = z.object({
  id: z.uuid(),
  nombre: z.string().trim().min(2, "Escribe el nombre").max(100),
  correo: correoOpcional,
  rol: z.enum(ROLES),
  estado: z.enum(ESTADOS_USUARIO),
  vence_el: fechaOpcional,
});
export type DatosEditarUsuario = z.input<typeof esquemaEditarUsuario>;

export const esquemaRestablecer = z.object({
  id: z.uuid(),
  clave: esquemaClave,
  debe_cambiar_clave: z.boolean(),
});
export type DatosRestablecer = z.input<typeof esquemaRestablecer>;
