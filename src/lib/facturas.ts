/** Número visible de una factura: prefijo + consecutivo, o el número externo. */
export function numeroFactura(
  f: { origen?: string | null; numero?: number | null; numero_externo?: string | null },
  prefijo = "",
): string {
  if (f.origen === "externa") return f.numero_externo ? `${f.numero_externo}` : "s/n";
  return f.numero ? `${prefijo}${String(f.numero).padStart(6, "0")}` : "Borrador";
}

export const ESTADOS_PAGO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "border-warning/40 bg-warning/10 text-warning" },
  abonada: { texto: "Abonada", clase: "border-sky-400/40 bg-sky-400/10 text-sky-400" },
  pagada: { texto: "Pagada", clase: "border-success/40 bg-success/10 text-success" },
  anulada: { texto: "Anulada", clase: "border-destructive/40 bg-destructive/10 text-destructive line-through" },
  borrador: { texto: "Borrador", clase: "border-border text-muted-foreground" },
};
