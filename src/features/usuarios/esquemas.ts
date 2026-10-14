import { z } from "zod";
import { ESTADOS_USUARIO, ROLES } from "@/lib/auth/roles";
import { esquemaClave } from "@/features/auth/esquemas";

const correo = z.string().trim().toLowerCase().min(1, "Escribe el correo").pipe(z.email("Correo no válido"));

export const esquemaNuevoUsuario = z.object({
  correo,
  nombre: z.string().trim().min(2, "Escribe el nombre").max(100),
  rol: z.enum(ROLES),
  clave: esquemaClave,
  debe_cambiar_clave: z.boolean(),
});
export type DatosNuevoUsuario = z.input<typeof esquemaNuevoUsuario>;

export const esquemaEditarUsuario = z.object({
  id: z.uuid(),
  correo,
  nombre: z.string().trim().min(2, "Escribe el nombre").max(100),
  rol: z.enum(ROLES),
  estado: z.enum(ESTADOS_USUARIO),
});
export type DatosEditarUsuario = z.input<typeof esquemaEditarUsuario>;

export const esquemaRestablecer = z.object({
  id: z.uuid(),
  clave: esquemaClave,
  debe_cambiar_clave: z.boolean(),
});
export type DatosRestablecer = z.input<typeof esquemaRestablecer>;
