import { z } from "zod";

export const esquemaLogin = z.object({
  correo: z.string().trim().toLowerCase().min(1, "Escribe tu correo").pipe(z.email("Correo no válido")),
  clave: z.string().min(1, "Escribe tu contraseña"),
  siguiente: z.string().optional(),
});
export type DatosLogin = z.input<typeof esquemaLogin>;

export const esquemaClave = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
  .regex(/\d/, "Debe incluir al menos un número");

export const esquemaCambioClave = z
  .object({ clave: esquemaClave, confirmar: z.string() })
  .refine((d) => d.clave === d.confirmar, { message: "Las contraseñas no coinciden", path: ["confirmar"] });
export type DatosCambioClave = z.infer<typeof esquemaCambioClave>;
