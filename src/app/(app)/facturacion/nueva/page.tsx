import type { Metadata } from "next";
import { exigirPerfil } from "@/lib/auth/sesion";
import { hoyISO } from "@/lib/fechas";
import { cargarDatosFormulario, cargarFactura } from "@/features/facturacion/datos";
import { FormularioFactura, type FacturaInicial } from "@/features/facturacion/formulario-factura";

export const metadata: Metadata = { title: "Nueva factura" };
const entero = (v: string | string[] | undefined) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

/** Nueva factura. ?cliente=ID la abre con ese cliente; ?duplicar=ID copia otra factura (sin número). */
export default async function PaginaNuevaFactura({ searchParams }: PageProps<"/facturacion/nueva">) {
  const perfil = await exigirPerfil("facturar");
  const sp = await searchParams;
  const hoy = hoyISO();
  const [datos, origen] = await Promise.all([
    cargarDatosFormulario(),
    entero(sp.duplicar) ? cargarFactura(entero(sp.duplicar)!) : Promise.resolve(null),
  ]);
  const clienteId = origen?.cliente_id ?? entero(sp.cliente);
  const inicial: FacturaInicial | undefined = origen
    ? {
        cliente_id: datos.clientes.some((c) => c.id === origen.cliente_id) ? origen.cliente_id : null,
        fecha: hoy, moneda: origen.moneda, condicion: origen.condicion, ubicacion_id: origen.ubicacion_id,
        observaciones: origen.observaciones ?? "", iva_pct: Number(origen.iva_pct),
        lineas: origen.factura_lineas
          .filter((l) => datos.productos.some((p) => p.id === l.producto_id))
          .map((l) => ({ producto_id: l.producto_id, cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario), aplica_iva: l.aplica_iva })),
      }
    : clienteId && datos.clientes.some((c) => c.id === clienteId)
      ? { cliente_id: clienteId, fecha: hoy, moneda: datos.empresa.moneda_defecto, condicion: "credito", ubicacion_id: null, observaciones: "", iva_pct: datos.empresa.iva_pct, lineas: [] }
      : undefined;
  return <FormularioFactura datos={datos} hoy={hoy} inicial={inicial} modo="nueva" esAdmin={perfil.rol === "admin"} />;
}
