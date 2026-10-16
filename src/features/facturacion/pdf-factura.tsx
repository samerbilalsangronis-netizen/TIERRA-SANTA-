import "server-only";
import { Circle, Document, Ellipse, G, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatearCantidad, formatearMonto, formatearNumero } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { numeroFactura } from "@/lib/facturas";
import { montoEnLetras } from "@/lib/numeros-a-letras";
import type { EmpresaDocumento, FacturaCompleta } from "./datos";
import { DISPOSICION, FRUTAS, OPACIDAD_MARCA } from "./frutas";

// Carta: 612 × 792 puntos
const ANCHO = 612, ALTO = 792;
const trazo = { stroke: "#171717", strokeWidth: 1.4, fill: "none", strokeOpacity: OPACIDAD_MARCA } as const;

/** Marca de agua de frutas, muy tenue, en todas las páginas. */
function MarcaFrutasPdf() {
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, width: ANCHO, height: ALTO }}>
      {DISPOSICION.map((d, i) => {
        const lado = (d.tam / 100) * ANCHO;
        return (
          <Svg key={i} viewBox="0 0 100 100" style={{ position: "absolute", left: (d.x / 100) * ANCHO, top: (d.y / 100) * ALTO, width: lado, height: lado }}>
            <G transform={`rotate(${d.giro} 50 50)`}>
              {FRUTAS[d.fruta].map((f, j) =>
                f.tipo === "path" ? <Path key={j} d={f.d} {...trazo} />
                  : f.tipo === "circulo" ? <Circle key={j} cx={f.cx} cy={f.cy} r={f.r} {...trazo} />
                  : <Ellipse key={j} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} {...trazo} />)}
            </G>
          </Svg>
        );
      })}
    </View>
  );
}

const gris = "#525252";
const s = StyleSheet.create({
  pagina: { paddingTop: 36, paddingBottom: 54, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: "#171717" },
  fila: { flexDirection: "row" },
  encabezado: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#d4d4d4", paddingBottom: 10 },
  logo: { width: 80, height: 48, objectFit: "contain", marginRight: 10 },
  razon: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  chico: { fontSize: 8, color: gris },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#171717", textAlign: "right" },
  derecha: { textAlign: "right" },
  cliente: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderBottomColor: "#d4d4d4", paddingVertical: 8 },
  campoCliente: { width: "50%", paddingVertical: 1 },
  etiqueta: { color: gris },
  negrita: { fontFamily: "Helvetica-Bold" },
  tabla: { marginTop: 10 },
  thead: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#262626", paddingBottom: 3, fontSize: 7.5, color: gris, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 3 },
  trPar: { backgroundColor: "#f5f5f5" },
  cCod: { width: "9%" }, cDesc: { width: "35%" }, cCant: { width: "12%", textAlign: "right" }, cUni: { width: "9%", paddingLeft: 4 },
  cPrecio: { width: "13%", textAlign: "right" }, cIva: { width: "7%", textAlign: "center" }, cTotal: { width: "15%", textAlign: "right" },
  pie: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  totales: { width: 190 },
  lineaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  granTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: "#262626", marginTop: 3, paddingTop: 4, fontSize: 11, fontFamily: "Helvetica-Bold" },
  firmas: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  firma: { width: "42%", borderTopWidth: 0.75, borderTopColor: "#737373", paddingTop: 3, textAlign: "center", fontSize: 8, color: gris },
  anulada: { position: "absolute", top: 300, left: 90, fontSize: 80, color: "#dc2626", opacity: 0.35, transform: "rotate(-20deg)", fontFamily: "Helvetica-Bold", borderWidth: 6, borderColor: "#dc2626", paddingHorizontal: 16 },
  numeroPagina: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 7.5, color: "#737373" },
});

/** Factura en PDF (carta). Mismo contenido que la hoja HTML. */
export function PdfFactura({ factura: f, empresa, logo }: {
  factura: FacturaCompleta; empresa: EmpresaDocumento; logo: { data: Buffer; format: "png" | "jpg" } | string | null;
}) {
  const dec = f.moneda === "COP" ? 0 : 2;
  const hayIva = f.factura_lineas.some((l) => l.aplica_iva);
  const num = numeroFactura(f, empresa.factura_prefijo);
  const anchoDesc = hayIva ? s.cDesc : { width: "42%" };
  return (
    <Document title={`${empresa.titulo_documento} ${num}`} author={empresa.razon_social} language="es">
      <Page size="LETTER" style={s.pagina}>
        <MarcaFrutasPdf />
        {f.estado === "anulada" && <Text style={s.anulada} fixed>ANULADA</Text>}
        <View style={s.encabezado}>
          <View style={[s.fila, { maxWidth: "58%" }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el Image de react-pdf no admite alt */}
            {logo && <Image src={logo} style={s.logo} />}
            <View>
              <Text style={s.razon}>{empresa.razon_social}</Text>
              {[empresa.rif, empresa.telefonos].filter(Boolean).length > 0 && <Text style={s.chico}>{[empresa.rif, empresa.telefonos].filter(Boolean).join(" · ")}</Text>}
              {empresa.direccion ? <Text style={s.chico}>{empresa.direccion}</Text> : null}
              {empresa.correo ? <Text style={s.chico}>{empresa.correo}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.titulo}>{empresa.titulo_documento.toUpperCase()}</Text>
            <Text style={[s.derecha, s.negrita, { fontSize: 11 }]}>Nº {num}</Text>
            <Text style={[s.derecha, s.chico]}>Fecha: {formatearFecha(f.fecha)}</Text>
            <Text style={[s.derecha, s.chico]}>Moneda: {f.moneda}</Text>
            <Text style={[s.derecha, s.chico]}>Condición: {f.condicion === "contado" ? "Contado" : "Crédito"}</Text>
          </View>
        </View>

        <View style={s.cliente}>
          <Text style={s.campoCliente}><Text style={s.etiqueta}>Cliente: </Text><Text style={s.negrita}>{f.cliente_nombre}</Text> (nº {f.cliente_numero})</Text>
          <Text style={s.campoCliente}><Text style={s.etiqueta}>Cédula/RIF: </Text>{f.cliente_documento || "—"}</Text>
          <Text style={s.campoCliente}><Text style={s.etiqueta}>Teléfono: </Text>{f.cliente_telefono || "—"}</Text>
          <Text style={s.campoCliente}><Text style={s.etiqueta}>Dirección: </Text>{f.cliente_direccion || "—"}</Text>
        </View>

        <View style={s.tabla}>
          <View style={s.thead} fixed>
            <Text style={s.cCod}>Código</Text><Text style={anchoDesc}>Descripción</Text><Text style={s.cCant}>Cantidad</Text>
            <Text style={s.cUni}>Unidad</Text><Text style={s.cPrecio}>Precio</Text>{hayIva && <Text style={s.cIva}>IVA</Text>}<Text style={s.cTotal}>Total</Text>
          </View>
          {f.factura_lineas.map((l, i) => (
            <View key={l.id} style={i % 2 ? [s.tr, s.trPar] : s.tr} wrap={false}>
              <Text style={s.cCod}>{l.codigo}</Text><Text style={anchoDesc}>{l.descripcion}</Text>
              <Text style={s.cCant}>{formatearCantidad(l.cantidad)}</Text><Text style={s.cUni}>{l.unidad}</Text>
              <Text style={s.cPrecio}>{formatearNumero(l.precio_unitario, dec)}</Text>
              {hayIva && <Text style={s.cIva}>{l.aplica_iva ? "Sí" : "No"}</Text>}
              <Text style={s.cTotal}>{formatearNumero(l.total_linea, dec)}</Text>
            </View>
          ))}
        </View>

        <View style={s.pie} wrap={false}>
          <View style={{ width: "55%" }}>
            <Text><Text style={s.etiqueta}>Son: </Text><Text style={s.negrita}>{montoEnLetras(f.total, f.moneda)}</Text></Text>
            {f.observaciones ? <Text style={{ marginTop: 6 }}><Text style={s.etiqueta}>Observaciones: </Text>{f.observaciones}</Text> : null}
            {f.estado === "anulada" && f.motivo_anulacion ? <Text style={{ marginTop: 6, color: "#b91c1c" }}>Anulada: {f.motivo_anulacion}</Text> : null}
          </View>
          <View style={s.totales}>
            <View style={s.lineaTotal}><Text style={s.etiqueta}>Subtotal</Text><Text>{formatearNumero(f.subtotal, dec)}</Text></View>
            {hayIva && (
              <>
                <View style={s.lineaTotal}><Text style={s.etiqueta}>Base imponible</Text><Text>{formatearNumero(f.base_imponible, dec)}</Text></View>
                <View style={s.lineaTotal}><Text style={s.etiqueta}>Exento</Text><Text>{formatearNumero(f.exento, dec)}</Text></View>
                <View style={s.lineaTotal}><Text style={s.etiqueta}>IVA {formatearCantidad(f.iva_pct)}%</Text><Text>{formatearNumero(f.iva, dec)}</Text></View>
              </>
            )}
            <View style={s.granTotal}><Text>TOTAL</Text><Text>{formatearMonto(f.total, f.moneda)}</Text></View>
          </View>
        </View>

        <View style={s.firmas} wrap={false}>
          <Text style={s.firma}>Despachado por</Text>
          <Text style={s.firma}>Recibido conforme (cliente)</Text>
        </View>
        {empresa.pie_factura ? <Text style={[s.chico, { textAlign: "center", marginTop: 18 }]}>{empresa.pie_factura}</Text> : null}
        {empresa.texto_legal ? <Text style={[s.chico, { textAlign: "center", marginTop: 4, fontSize: 7 }]}>{empresa.texto_legal}</Text> : null}
        <Text style={s.numeroPagina} fixed render={({ pageNumber, totalPages }) => `${empresa.titulo_documento} ${num} · página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}
