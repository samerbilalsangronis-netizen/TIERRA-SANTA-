"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import type { Resultado } from "@/lib/acciones";

/**
 * Formulario de catálogo: valida con Zod en el navegador, envía los valores crudos
 * a la Server Action (que vuelve a validar) y muestra el resultado.
 */
export function useFormularioCatalogo<E extends z.ZodType<unknown, FieldValues>>(
  esquema: E,
  inicial: DefaultValues<z.input<E>>,
  accion: (d: z.input<E>) => Promise<Resultado>,
  alGuardar: () => void,
) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const form = useForm<z.input<E>, unknown, z.output<E>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(esquema as any) as never,
    defaultValues: inicial,
  });
  const enviar = form.handleSubmit(() =>
    iniciar(async () => {
      const r = await accion(form.getValues());
      if (!r.ok) {
        toast.error(r.error);
        Object.entries(r.campos ?? {}).forEach(([k, m]) => form.setError(k as Path<z.input<E>>, { message: m }));
        return;
      }
      toast.success(r.mensaje);
      router.refresh();
      alGuardar();
    }),
  );
  return { form, enviar, pendiente, err: form.formState.errors as Record<string, { message?: string } | undefined> };
}
