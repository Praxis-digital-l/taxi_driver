import { describe, expect, it } from "vitest";
import { requiresExpirationDate } from "./documentRules";

describe("documentRules", () => {
  it("retorna true para los 5 tipos de documentos requeridos", () => {
    expect(requiresExpirationDate("Revisión Técnica")).toBe(true);
    expect(requiresExpirationDate("revision tecnica")).toBe(true);
    expect(requiresExpirationDate("Permiso de circulación")).toBe(true);
    expect(requiresExpirationDate("PERMISO DE CIRCULACION")).toBe(true);
    expect(requiresExpirationDate("SOAP")).toBe(true);
    expect(requiresExpirationDate("soap")).toBe(true);
    expect(requiresExpirationDate("PERMISO DE ASIENTO")).toBe(true);
    expect(requiresExpirationDate("Permiso de asiento")).toBe(true);
    expect(requiresExpirationDate("SEGURO CONDUCTOR")).toBe(true);
    expect(requiresExpirationDate("Seguro Conductor")).toBe(true);
  });

  it("retorna true si el objeto tiene requires_expiration = true", () => {
    expect(requiresExpirationDate({ name: "Cualquier cosa", requires_expiration: true })).toBe(true);
  });

  it("retorna false para documentos que no requieren fecha de vencimiento", () => {
    expect(requiresExpirationDate("Boleta por compra de bencina")).toBe(false);
    expect(requiresExpirationDate("Boleta de combustible")).toBe(false);
    expect(requiresExpirationDate("Factura")).toBe(false);
    expect(requiresExpirationDate("Liquidación")).toBe(false);
    expect(requiresExpirationDate("Contrato")).toBe(false);
    expect(requiresExpirationDate("Comprobante de transferencia")).toBe(false);
    expect(requiresExpirationDate("")).toBe(false);
    expect(requiresExpirationDate(null)).toBe(false);
    expect(requiresExpirationDate(undefined)).toBe(false);
  });
});

