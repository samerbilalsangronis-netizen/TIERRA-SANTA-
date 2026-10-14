import { z } from "zod";
import { parsearMonto } from "@/lib/dinero";

/** Número escrito por el usuario ("4.000", "12,5", "0,25") → number | null. */
export const numeroLibre = (msg = "Número no válido") =>
  z.union([z.number(), z.string(), z.null(), z.undefined()]).transform((v, ctx) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    if (v.trim() === "") return null;
    const d = parsearMonto(v);
    if (!d) { ctx.addIssue({ code: "custom", message: msg }); return z.NEVER; }
    return d.toNumber();
  });

export const textoOpcional = (max = 300) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional().transform((v) => (v ? v : null));

export const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

export const idOpcional = z.union([z.number(), z.string()]).optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)));
