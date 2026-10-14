import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatearMonto } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { ESTADOS_PAGO, numeroFactura } from "@/lib/facturas";
import { cn } from "@/lib/utils";

export type FilaFactura = {
  id: number; origen: string; numero: number | null; numero_externo: string | null; estado: string; estado_pago: string;
  fecha: string; moneda: string; cliente_id: number; cliente_numero: number | null; cliente_nombre: string;
  total: number; pagado: number; saldo: number; version: number;
};

export function BadgeEstadoFactura({ estado }: { estado: string }) {
  const e = ESTADOS_PAGO[estado] ?? ESTADOS_PAGO.pendiente;
  return <Badge variant="outline" className={e.clase}>{e.texto}</Badge>;
}

/** Enlace de una fila: las del sistema abren la factura; las históricas, la ficha del cliente. */
const enlace = (f: FilaFactura) => (f.origen === "externa" ? `/clientes/${f.cliente_id}` : `/facturacion/${f.id}`);

export function ListaFacturas({ facturas, prefijo }: { facturas: FilaFactura[]; prefijo: string }) {
  const doc = (f: FilaFactura) => numeroFactura(f, prefijo);
  return (
    <>
      {/* PC */}
      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Factura</th><th className="p-3">Fecha</th><th className="p-3">Cliente</th>
              <th className="p-3 text-right">Total</th><th className="p-3 text-right">Saldo</th><th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {facturas.map((f) => (
              <tr key={f.id} className={cn("hover:bg-muted/40", f.estado === "anulada" && "opacity-60")}>
                <td className="p-3">
                  <Link href={enlace(f)} className="font-mono font-semibold hover:text-primary">{doc(f)}</Link>
                  {(f.origen === "externa" || f.version > 1) && (
                    <span className="block text-[11px] text-muted-foreground">{f.origen === "externa" ? "Histórica" : `Editada (v${f.version})`}</span>
                  )}
                </td>
                <td className="whitespace-nowrap p-3">{formatearFecha(f.fecha)}</td>
                <td className="p-3">
                  <Link href={`/clientes/${f.cliente_id}`} className="hover:text-primary">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">{f.cliente_numero}</span>{f.cliente_nombre}
                  </Link>
                </td>
                <td className="tabular whitespace-nowrap p-3 text-right">{formatearMonto(f.total, f.moneda)}</td>
                <td className="tabular whitespace-nowrap p-3 text-right font-semibold">{Number(f.saldo) ? formatearMonto(f.saldo, f.moneda, { sinCodigo: true }) : "—"}</td>
                <td className="p-3"><BadgeEstadoFactura estado={f.estado_pago} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Teléfono */}
      <ul className="space-y-2 md:hidden">
        {facturas.map((f) => (
          <li key={f.id}>
            <Link href={enlace(f)} className={cn("block rounded-2xl border bg-card p-3", f.estado === "anulada" && "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold">{doc(f)}</span>
                <BadgeEstadoFactura estado={f.estado_pago} />
              </div>
              <p className="truncate text-sm">{f.cliente_nombre}</p>
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatearFecha(f.fecha)}{f.origen === "externa" ? " · histórica" : ""}</span>
                <span className="tabular text-sm font-semibold text-foreground">{formatearMonto(f.total, f.moneda)}</span>
              </div>
              {Number(f.saldo) > 0 && Number(f.saldo) < Number(f.total) && (
                <p className="tabular text-right text-xs text-warning">Debe {formatearMonto(f.saldo, f.moneda)}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
