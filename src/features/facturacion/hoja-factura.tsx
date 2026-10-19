import { EncabezadoHoja, Hoja } from "@/components/comunes/hoja";
import { formatearCantidad, formatearMonto, formatearNumero } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { numeroFactura } from "@/lib/facturas";
import { montoEnLetras } from "@/lib/numeros-a-letras";
import type { EmpresaDocumento, FacturaCompleta } from "./datos";
import { DISPOSICION, FRUTAS, OPACIDAD_MARCA, type Figura } from "./frutas";

function FiguraSvg({ f }: { f: Figura }) {
  if (f.tipo === "path") return <path d={f.d} />;
  if (f.tipo === "circulo") return <circle cx={f.cx} cy={f.cy} r={f.r} />;
  return <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} />;
}

/** Marca de agua de frutas, muy tenue, detrás del contenido (sale también al imprimir). */
function MarcaFrutas() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: OPACIDAD_MARCA }}>
      {DISPOSICION.map((d, i) => (
        <svg key={i} viewBox="0 0 100 100" className="absolute" fill="none" stroke="#171717" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.tam}%`, transform: `rotate(${d.giro}deg)` }}>
          {FRUTAS[d.fruta].map((f, j) => <FiguraSvg key={j} f={f} />)}
        </svg>
      ))}
    </div>
  );
}

/** Documento de la factura en pantalla (igual al PDF). Se imprime con el botón "Imprimir". */
export function HojaFactura({ factura: f, empresa }: { factura: FacturaCompleta; empresa: EmpresaDocumento }) {
  const decimales = f.moneda === "COP" ? 0 : 2;
  const hayIva = f.factura_lineas.some((l) => l.aplica_iva);
  return (
    <Hoja>
      <div className="relative">
        <MarcaFrutas />
        <div className="relative">
        {f.estado === "anulada" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
            <span className="-rotate-[20deg] rounded-xl border-8 border-red-600/60 px-8 py-2 text-6xl font-black tracking-widest text-red-600/60 sm:text-8xl">ANULADA</span>
          </div>
        )}
        {f.estado === "borrador" && (
          <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-center text-xs font-semibold text-amber-800">BORRADOR · sin número · no afecta inventario ni saldos</p>
        )}
        <EncabezadoHoja empresa={empresa}
          titulo={<>{empresa.titulo_documento.toUpperCase()} <span className="whitespace-nowrap">Nº {numeroFactura(f, empresa.factura_prefijo)}</span></>}
          lineas={[`Fecha: ${formatearFecha(f.fecha)}`, `Moneda: ${f.moneda}`, `Condición: ${f.condicion === "contado" ? "Contado" : "Crédito"}`]} />

        <section className="grid gap-x-6 gap-y-0.5 border-b border-neutral-300 py-3 sm:grid-cols-2">
          <p><span className="text-neutral-500">Cliente:</span> <b>{f.cliente_nombre}</b> <span className="text-neutral-500">(nº {f.cliente_numero})</span></p>
          <p><span className="text-neutral-500">Cédula/RIF:</span> {f.cliente_documento || "—"}</p>
          <p><span className="text-neutral-500">Teléfono:</span> {f.cliente_telefono || "—"}</p>
          <p><span className="text-neutral-500">Dirección:</span> {f.cliente_direccion || "—"}</p>
        </section>

        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[34rem] border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-800 text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="py-1.5 pr-2">Código</th><th className="py-1.5 pr-2">Descripción</th>
                <th className="py-1.5 pr-2 text-right">Cantidad</th><th className="py-1.5 pr-2">Unidad</th>
                <th className="py-1.5 pr-2 text-right">Precio</th>{hayIva && <th className="py-1.5 pr-2 text-center">IVA</th>}
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {f.factura_lineas.map((l, i) => (
                <tr key={l.id} className={i % 2 ? "bg-neutral-100" : ""}>
                  <td className="py-1 pr-2 font-mono">{l.codigo}</td>
                  <td className="py-1 pr-2">{l.descripcion}</td>
                  <td className="tabular py-1 pr-2 text-right">{formatearCantidad(l.cantidad)}</td>
                  <td className="py-1 pr-2">{l.unidad}</td>
                  <td className="tabular py-1 pr-2 text-right">{formatearNumero(l.precio_unitario, decimales)}</td>
                  {hayIva && <td className="py-1 pr-2 text-center">{l.aplica_iva ? "Sí" : "No"}</td>}
                  <td className="tabular py-1 text-right">{formatearNumero(l.total_linea, decimales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 sm:max-w-[60%]">
            <p className="text-xs"><span className="text-neutral-500">Son:</span> <b>{montoEnLetras(f.total, f.moneda)}</b></p>
            {f.observaciones && <p className="text-xs"><span className="text-neutral-500">Observaciones:</span> {f.observaciones}</p>}
            {f.estado === "anulada" && f.motivo_anulacion && <p className="text-xs text-red-700">Anulada: {f.motivo_anulacion}</p>}
          </div>
          <dl className="w-full space-y-0.5 sm:w-64">
            <div className="flex justify-between"><dt className="text-neutral-500">Subtotal</dt><dd className="tabular">{formatearNumero(f.subtotal, decimales)}</dd></div>
            {hayIva && (
              <>
                <div className="flex justify-between"><dt className="text-neutral-500">Base imponible</dt><dd className="tabular">{formatearNumero(f.base_imponible, decimales)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-500">Exento</dt><dd className="tabular">{formatearNumero(f.exento, decimales)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-500">IVA {formatearCantidad(f.iva_pct)}%</dt><dd className="tabular">{formatearNumero(f.iva, decimales)}</dd></div>
              </>
            )}
            <div className="flex justify-between border-t-2 border-neutral-800 pt-1 text-base font-bold">
              <dt>TOTAL</dt><dd className="tabular">{formatearMonto(f.total, f.moneda)}</dd>
            </div>
          </dl>
        </section>

        {/* Sello de la empresa (en lugar de las firmas) */}
        <div className="mt-6 flex justify-end pr-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija; también sale al imprimir */}
          <img src="/sello-tierra-santa.png" alt="Sello de Procesadora de Alimentos Tierra Santa" className="h-24 w-auto object-contain" />
        </div>
        {empresa.pie_factura && <p className="mt-6 text-center text-xs text-neutral-600">{empresa.pie_factura}</p>}
        {empresa.texto_legal && <p className="mt-2 text-center text-[10px] text-neutral-500">{empresa.texto_legal}</p>}
        </div>
      </div>
    </Hoja>
  );
}
