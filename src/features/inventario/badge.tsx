import { Badge } from "@/components/ui/badge";

const ESTILOS: Record<string, [string, string]> = {
  normal: ["Normal", "border-success/40 bg-success/10 text-success"],
  bajo: ["Bajo", "border-warning/40 bg-warning/10 text-warning"],
  agotado: ["Agotado", "border-destructive/40 bg-destructive/10 text-destructive"],
};

export function BadgeIndicador({ indicador }: { indicador: string }) {
  const [texto, clase] = ESTILOS[indicador] ?? ["—", ""];
  return <Badge variant="outline" className={clase}>{texto}</Badge>;
}
