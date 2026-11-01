import { describe, expect, it } from "vitest";
import { calcularRendimientoActivo } from "./rendimientoActivos";

const base = {
  arriendo: 500000,
  seguroTotal: 100000,
  mantencion: 50000,
  prorrateo: 20000,
  revisionTecnica: 10000,
  repuestos: 30000,
};

describe("calcularRendimientoActivo", () => {
  it("suma los repuestos de documentos y los de compra directa", () => {
    const resultado = calcularRendimientoActivo({ ...base, repuestosManual: 70000 });

    expect(resultado.repuestosDocumentos).toBe(30000);
    expect(resultado.repuestosManual).toBe(70000);
    expect(resultado.repuestos).toBe(100000);
    expect(resultado.totalDescuentos).toBe(230000);
    expect(resultado.rendimiento).toBe(270000);
  });

  it("mantiene el comportamiento cuando no hay compra directa", () => {
    const resultado = calcularRendimientoActivo(base);

    expect(resultado.repuestosManual).toBe(0);
    expect(resultado.repuestos).toBe(30000);
  });
});
