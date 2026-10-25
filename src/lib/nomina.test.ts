import { describe, expect, it } from "vitest";

import { calcularNomina, validarDatosNomina, type DatosNomina } from "./nomina";

const BASE: DatosNomina = {
  trabajadorId: "worker-1",
  nombre: "Ana Gómez",
  email: "ana@test.com",
  rut: "11.111.111-1",
  vehicle_id: "vehicle-1",
  vehicle_plate: "AA-BB-11",
  totalFacturado: 1_000_000,
  gastoOperacional: 0,
  diesel: 0,
  tag: {},
  arriendo: 0,
  seguro: 0,
  mantencion: 0,
  anticipo: 0,
  prestamo: 0,
  descuentosExtra: [],
  efectivoMonto: 0,
};

describe("calcularNomina", () => {
  it("no agrega descuentos extra cuando la lista está vacía", () => {
    const r = calcularNomina(BASE);

    expect(r.descuentosSecundarios).toEqual([
      { concepto: "Mantención", monto: 0 },
      { concepto: "Anticipo", monto: 0 },
      { concepto: "Préstamo", monto: 0 },
    ]);
    expect(r.totalDescuentos).toBe(0);
    expect(r.totalAPagar).toBe(1_000_000);
  });

  it("agrega varios descuentos extra al detalle (PDF) y al total", () => {
    const r = calcularNomina({
      ...BASE,
      descuentosExtra: [
        { descripcion: "Multa", monto: 20_000 },
        { descripcion: "Daño vehículo", monto: 30_000 },
      ],
    });

    expect(r.descuentosSecundarios).toContainEqual({
      concepto: "Descuento extra - Multa",
      monto: 20_000,
    });
    expect(r.descuentosSecundarios).toContainEqual({
      concepto: "Descuento extra - Daño vehículo",
      monto: 30_000,
    });
    expect(r.totalDescuentos).toBe(50_000);
    expect(r.totalAPagar).toBe(950_000);
  });

  it("usa un concepto genérico cuando el descuento extra no tiene descripción", () => {
    const r = calcularNomina({
      ...BASE,
      descuentosExtra: [{ descripcion: "   ", monto: 5_000 }],
    });

    expect(r.descuentosSecundarios).toContainEqual({ concepto: "Descuento extra", monto: 5_000 });
  });

  it("paga el 50% del saldo después de los descuentos primarios a conductores nuevos", () => {
    const r = calcularNomina({
      ...BASE,
      estadoConductor: "Nuevo",
      totalFacturado: 5_000_000,
      gastoOperacional: 200_000,
      diesel: 150_000,
      arriendo: 700_000,
      seguro: 100_000,
      efectivoMonto: 100_000,
      mantencion: 200_000,
      anticipo: 350_000,
      prestamo: 150_000,
    });

    expect(r.descuentosSecundarios).toContainEqual({
      concepto: "Conductor nuevo (50%)",
      monto: 1_875_000,
    });
    expect(r.totalDescuentos).toBe(3_825_000);
    expect(r.totalAPagar).toBe(1_175_000);
  });

  it("mantiene el cálculo tradicional cuando el conductor deja de ser nuevo", () => {
    const r = calcularNomina({
      ...BASE,
      estadoConductor: "antiguo",
      totalFacturado: 5_000_000,
      gastoOperacional: 200_000,
      diesel: 150_000,
      arriendo: 700_000,
      seguro: 100_000,
      efectivoMonto: 100_000,
      mantencion: 200_000,
      anticipo: 350_000,
      prestamo: 150_000,
    });

    expect(r.descuentosSecundarios).not.toContainEqual(
      expect.objectContaining({ concepto: "Conductor nuevo (50%)" })
    );
    expect(r.totalDescuentos).toBe(1_950_000);
    expect(r.totalAPagar).toBe(3_050_000);
  });
});

describe("validarDatosNomina", () => {
  it("rechaza un descuento extra con monto inválido", () => {
    const errores = validarDatosNomina({
      ...BASE,
      descuentosExtra: [{ descripcion: "Multa", monto: -1 }],
    });

    expect(errores.some((e) => e.campo === "descuentoExtra.0")).toBe(true);
  });

  it("acepta descuentos extra válidos", () => {
    const errores = validarDatosNomina({
      ...BASE,
      descuentosExtra: [{ descripcion: "Multa", monto: 10_000 }],
    });

    expect(errores).toHaveLength(0);
  });
});
