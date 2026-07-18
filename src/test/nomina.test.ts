import { describe, expect, it } from "vitest";
import {
  calcularNomina,
  validarDatosNomina,
  crearDescuentosTAG,
  type DatosNomina,
} from "@/lib/nomina";

function datosBase(overrides?: Partial<DatosNomina>): DatosNomina {
  return {
    trabajadorId: "cond-001",
    nombre: "Juan Pérez",
    totalFacturado: 1500000,
    gastoOperacional: 100000,
    diesel: 200000,
    tag: crearDescuentosTAG(),
    arriendo: 150000,
    seguro: 50000,
    mantencion: 80000,
    anticipo: 100000,
    prestamo: 50000,
    ...overrides,
  };
}

describe("calcularNomina", () => {
  it("calcula correctamente con datos completos", () => {
    const data = datosBase();
    const result = calcularNomina(data);

    expect(result.totalFacturado).toBe(1500000);
    expect(result.subtotal).toBe(1000000);
    expect(result.totalAPagar).toBe(770000);
    expect(result.totalDescuentos).toBe(730000);
  });

  it("incluye el desglose de TAG cuando hay múltiples autopistas", () => {
    const data = datosBase({
      tag: {
        autopista1: 5000,
        autopista2: 3000,
        autopista3: 0,
        autopista4: 0,
        autopista5: 0,
        autopista6: 0,
        autopista7: 0,
        autopista8: 2000,
      },
    });

    const result = calcularNomina(data);

    expect(result.subtotal).toBe(990000);
    expect(result.totalAPagar).toBe(760000);
    expect(result.descuentosPrimarios).toEqual(
      expect.arrayContaining([
        { concepto: "TAG - Autopista 1", monto: 5000 },
        { concepto: "TAG - Autopista 2", monto: 3000 },
        { concepto: "TAG - Autopista 8", monto: 2000 },
      ]),
    );
  });

  it("no incluye autopistas con monto 0 en el desglose", () => {
    const data = datosBase();
    const result = calcularNomina(data);

    const tagItems = result.descuentosPrimarios.filter((d) =>
      d.concepto.startsWith("TAG"),
    );
    expect(tagItems).toHaveLength(0);
  });

  it("retorna total a pagar 0 cuando los descuentos superan el subtotal", () => {
    const data = datosBase({
      totalFacturado: 500000,
      gastoOperacional: 100000,
      diesel: 100000,
      arriendo: 50000,
      seguro: 50000,
      mantencion: 200000,
      anticipo: 50000,
      prestamo: 50000,
    });

    const result = calcularNomina(data);

    expect(result.subtotal).toBe(200000);
    expect(result.totalAPagar).toBe(-100000);
  });

  it("contiene los campos esperados en el resultado", () => {
    const result = calcularNomina(datosBase());

    expect(result).toHaveProperty("trabajadorId");
    expect(result).toHaveProperty("nombre");
    expect(result).toHaveProperty("totalFacturado");
    expect(result).toHaveProperty("descuentosPrimarios");
    expect(result).toHaveProperty("subtotal");
    expect(result).toHaveProperty("descuentosSecundarios");
    expect(result).toHaveProperty("totalDescuentos");
    expect(result).toHaveProperty("totalAPagar");
  });

  it("descuentosPrimarios contiene los 5 conceptos base", () => {
    const result = calcularNomina(datosBase());

    const conceptos = result.descuentosPrimarios.map((d) => d.concepto);
    expect(conceptos).toContain("Gasto operacional");
    expect(conceptos).toContain("Diesel");
    expect(conceptos).toContain("Arriendo");
    expect(conceptos).toContain("Seguro");
  });

  it("descuentosSecundarios contiene los 3 conceptos finales", () => {
    const result = calcularNomina(datosBase());

    const conceptos = result.descuentosSecundarios.map((d) => d.concepto);
    expect(conceptos).toEqual(["Mantención", "Anticipo", "Préstamo"]);
  });

  it("mantiene correctamente los nombres del trabajador", () => {
    const result = calcularNomina(datosBase({ nombre: "María García" }));

    expect(result.nombre).toBe("María García");
    expect(result.trabajadorId).toBe("cond-001");
  });
});

describe("validarDatosNomina", () => {
  it("retorna errores cuando los campos obligatorios están vacíos", () => {
    const errores = validarDatosNomina({});

    expect(errores.length).toBeGreaterThanOrEqual(2);
    expect(errores.some((e) => e.campo === "trabajadorId")).toBe(true);
    expect(errores.some((e) => e.campo === "nombre")).toBe(true);
  });

  it("retorna errores para montos negativos", () => {
    const errores = validarDatosNomina({
      trabajadorId: "x",
      nombre: "x",
      totalFacturado: -1000,
      gastoOperacional: 0,
      diesel: 0,
      tag: crearDescuentosTAG(),
      arriendo: 0,
      seguro: 0,
      mantencion: 0,
      anticipo: 0,
      prestamo: 0,
    });

    expect(errores.some((e) => e.campo === "totalFacturado")).toBe(true);
  });

  it("retorna errores para valores no numéricos en campos numéricos", () => {
    const errores = validarDatosNomina({
      trabajadorId: "x",
      nombre: "x",
      totalFacturado: NaN,
      gastoOperacional: 0,
      diesel: 0,
      tag: crearDescuentosTAG(),
      arriendo: 0,
      seguro: 0,
      mantencion: 0,
      anticipo: 0,
      prestamo: 0,
    });

    expect(errores.some((e) => e.campo === "totalFacturado")).toBe(true);
  });

  it("retorna sin errores para datos válidos", () => {
    const errores = validarDatosNomina(datosBase());

    expect(errores).toHaveLength(0);
  });
});
