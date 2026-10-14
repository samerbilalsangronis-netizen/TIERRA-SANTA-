import { Coins, DollarSign, Package, Truck } from "lucide-react";
import { TarjetaKpi } from "@/components/comunes/tarjeta-kpi";
import { formatearMonto } from "@/lib/dinero";

export function KpisProveedores({ kpis }: { kpis: Record<string, number> }) {
  const n = (k: string) => Number(kpis[k] ?? 0);
  return (
    <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TarjetaKpi titulo="Proveedores" icono={Truck} valor={n("proveedores")} detalle={`${n("con_saldo")} con saldo pendiente`} />
      <TarjetaKpi titulo="Por pagar COP" icono={Coins} tono={n("saldo_cop") > 0 ? "alerta" : "exito"} valor={formatearMonto(n("saldo_cop"), "COP")} />
      <TarjetaKpi titulo="Por pagar USD" icono={DollarSign} tono={n("saldo_usd") > 0 ? "alerta" : "exito"} valor={formatearMonto(n("saldo_usd"), "USD")} />
      <TarjetaKpi titulo="Cestas pendientes" icono={Package} tono="neutro" valor={n("cestas_pendientes")} detalle="Entregadas − devueltas" />
    </section>
  );
}
