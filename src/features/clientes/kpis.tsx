import { AlertTriangle, CheckCircle2, Coins, DollarSign, Package, Users } from "lucide-react";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { formatearMonto } from "@/lib/dinero";

export function KpisClientes({ kpis }: { kpis: Record<string, number> }) {
  const n = (k: string) => Number(kpis[k] ?? 0);
  return (
    <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      <TarjetaKpi titulo="Clientes" icono={Users} valor={n("clientes")} />
      <TarjetaKpi titulo="Por cobrar USD" icono={DollarSign} tono={n("saldo_usd") > 0 ? "alerta" : "exito"} valor={formatearMonto(n("saldo_usd"), "USD")} />
      <TarjetaKpi titulo="Por cobrar COP" icono={Coins} tono={n("saldo_cop") > 0 ? "alerta" : "exito"} valor={formatearMonto(n("saldo_cop"), "COP")} />
      <TarjetaKpi titulo="Cajas pendientes" icono={Package} tono="neutro" valor={n("cajas_pendientes")} />
      <TarjetaKpi titulo="Al día" icono={CheckCircle2} tono="exito" valor={n("al_dia")} />
      <TarjetaKpi titulo="Críticos" icono={AlertTriangle} tono={n("criticos") > 0 ? "peligro" : "neutro"} valor={n("criticos")} />
    </section>
  );
}
