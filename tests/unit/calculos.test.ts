import { describe, expect, it } from "vitest";
import { calcularEntrega } from "@/lib/calculos/entregas";
import { calcularTotales, estadoPago, repartirPago } from "@/lib/calculos/factura";
import { estadoCliente, etiquetaMoneda, pendientes, saldoProveedor } from "@/lib/calculos/saldos";
import { calcularJornada, saldoNeto } from "@/lib/calculos/nomina";

describe("Entregas de proveedores", () => {
  it("FIJO: 10 cestas × 20 kg a 60.000/cesta con 5 kg de merma", () => {
    const r = calcularEntrega({ modo: "FIJO", kgPorCesta: 20, cestas: 10, precio: 60000, merma: 5 });
    expect(r.kgTotal.toNumber()).toBe(200);
    expect(r.precioKg.toNumber()).toBe(3000);
    expect(r.descMerma.toNumber()).toBe(15000);
    expect(r.total.toNumber()).toBe(585000);
    expect(r.pesoNeto.toNumber()).toBe(195);
  });
  it("VARIABLE: 80 kg por 40 USD con 4 kg de merma", () => {
    const r = calcularEntrega({ modo: "VARIABLE", kgTotal: 80, precio: 40, merma: 4 });
    expect(r.precioKg.toNumber()).toBe(0.5);
    expect(r.descMerma.toNumber()).toBe(2);
    expect(r.total.toNumber()).toBe(38);
    expect(r.pesoNeto.toNumber()).toBe(76);
  });
  it("sin merma el total es cestas × precio", () => {
    expect(calcularEntrega({ modo: "FIJO", kgPorCesta: 18, cestas: 3, precio: 7.5 }).total.toNumber()).toBe(22.5);
  });
  it("redondea la merma a 2 decimales", () => {
    // precio_kg = 10/3 = 3,3333…; merma 1 kg → 3,33
    expect(calcularEntrega({ modo: "FIJO", kgPorCesta: 3, cestas: 1, precio: 10, merma: 1 }).descMerma.toNumber()).toBe(3.33);
  });
  it("valida datos imposibles", () => {
    expect(() => calcularEntrega({ modo: "FIJO", kgPorCesta: 0, cestas: 1, precio: 1 })).toThrow();
    expect(() => calcularEntrega({ modo: "VARIABLE", kgTotal: 0, precio: 1 })).toThrow();
    expect(() => calcularEntrega({ modo: "VARIABLE", kgTotal: 10, precio: 1, merma: 11 })).toThrow();
  });
});

describe("Totales de factura con IVA", () => {
  it("400 × 2,50 con IVA + 50 × 3 exento al 16 %", () => {
    const t = calcularTotales(
      [{ cantidad: 400, precioUnitario: 2.5, aplicaIva: true }, { cantidad: 50, precioUnitario: 3, aplicaIva: false }], 16);
    expect(t.baseImponible.toNumber()).toBe(1000);
    expect(t.exento.toNumber()).toBe(150);
    expect(t.iva.toNumber()).toBe(160);
    expect(t.total.toNumber()).toBe(1310);
  });
  it("evita errores de coma flotante", () => {
    const t = calcularTotales([{ cantidad: 3, precioUnitario: 0.1, aplicaIva: false }], 16);
    expect(t.total.toString()).toBe("0.3");
  });
  it("redondea el IVA sobre la base", () => {
    const t = calcularTotales([{ cantidad: 1, precioUnitario: 10.33, aplicaIva: true }], 16);
    expect(t.iva.toNumber()).toBe(1.65);
    expect(t.total.toNumber()).toBe(11.98);
  });
});

describe("Pagos aplicados por factura", () => {
  const facturas = [
    { id: 103, fecha: "2026-10-03", saldo: 1500 },
    { id: 101, fecha: "2026-10-01", saldo: 1310 },
    { id: 102, fecha: "2026-10-02", saldo: 1000 },
  ];
  it("reparte de la más vieja a la más nueva y deja la última abonada", () => {
    const { reparto, sobrante } = repartirPago(3210, facturas);
    expect(reparto.map((r) => [r.facturaId, r.monto.toNumber(), r.completa])).toEqual([
      [101, 1310, true], [102, 1000, true], [103, 900, false],
    ]);
    expect(sobrante.toNumber()).toBe(0);
  });
  it("el excedente queda como saldo a favor", () => {
    expect(repartirPago(4000, facturas).sobrante.toNumber()).toBe(190);
  });
  it("estado de pago", () => {
    expect(estadoPago("emitida", 100, 0)).toBe("pendiente");
    expect(estadoPago("emitida", 100, 40)).toBe("abonada");
    expect(estadoPago("emitida", 100, 100)).toBe("pagada");
    expect(estadoPago("anulada", 100, 0)).toBe("anulada");
  });
});

describe("Saldos", () => {
  it("estado y etiqueta de moneda del cliente", () => {
    expect(estadoCliente({ USD: 0, COP: -5 })).toBe("AL DÍA");
    expect(estadoCliente({ USD: 10, COP: 0 })).toBe("CRÍTICO");
    expect(etiquetaMoneda({ USD: 10, COP: 20 })).toBe("USD/COP");
    expect(etiquetaMoneda({ USD: 0, COP: 20 })).toBe("COP");
    expect(etiquetaMoneda({ USD: 0, COP: 0 })).toBe("-");
  });
  it("saldo del proveedor por moneda", () => {
    const s = saldoProveedor([{ moneda: "COP", total: 585000 }, { moneda: "USD", total: 38 }], [{ moneda: "COP", monto: 85000 }]);
    expect(s.COP.toNumber()).toBe(500000);
    expect(s.USD.toNumber()).toBe(38);
  });
  it("cajas / cestas pendientes", () => {
    expect(pendientes([{ sale: 10, vuelve: 0 }, { sale: 0, vuelve: 4 }])).toBe(6);
  });
});

describe("Nómina", () => {
  it("fijo: asistió, media jornada y falta", () => {
    expect(calcularJornada({ tipo: "fijo", estado: "asistio", tarifaDia: 40000 }).ganado.toNumber()).toBe(40000);
    expect(calcularJornada({ tipo: "fijo", estado: "media", tarifaDia: 40000 }).ganado.toNumber()).toBe(20000);
    expect(calcularJornada({ tipo: "fijo", estado: "no", tarifaDia: 40000 }).ganado.toNumber()).toBe(0);
  });
  it("destajo: 3 cestas de Cortada de Durazno a 10.000 + pago adicional", () => {
    const j = calcularJornada({ tipo: "destajo", estado: "asistio", tarifaDia: 0, pagoAdicional: 5000, tareas: [{ cantidad: 3, valor: 10000 }] });
    expect(j.totalTareas.toNumber()).toBe(30000);
    expect(j.ganado.toNumber()).toBe(35000);
  });
  it("saldo neto = ganado − abonos", () => {
    expect(saldoNeto([30000, 30000], [20000]).toNumber()).toBe(40000);
  });
});
