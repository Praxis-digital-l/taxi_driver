import { describe, expect, it } from "vitest";
import {
  calculateLoanBreakdown,
  hasActiveLoanRequest,
  validateLoanRequest,
  isLoanRequestType,
  buildLoanDetails,
} from "./loanRules";

describe("loanRules", () => {
  describe("calculateLoanBreakdown", () => {
    it("calcula recargo del 20% y cuotas exactas", () => {
      const b = calculateLoanBreakdown(300000, 6);
      expect(b.montoSolicitado).toBe(300000);
      expect(b.recargoPorcentaje).toBe(20);
      expect(b.recargoMonto).toBe(60000);
      expect(b.totalConRecargo).toBe(360000);
      expect(b.cuotas).toBe(6);
      expect(b.valorCuota).toBe(60000);
    });

    it("limita cuotas a un máximo de 6", () => {
      const b = calculateLoanBreakdown(100000, 10);
      expect(b.cuotas).toBe(6);
    });

    it("limita cuotas a un mínimo de 1", () => {
      const b = calculateLoanBreakdown(100000, 0);
      expect(b.cuotas).toBe(1);
    });
  });

  describe("hasActiveLoanRequest", () => {
    it("detecta préstamos pendientes, en proceso o aprobados", () => {
      expect(
        hasActiveLoanRequest([{ status: "pendiente", request_types: { name: "Préstamo" } }])
      ).toBe(true);
      expect(
        hasActiveLoanRequest([{ status: "en_proceso", request_types: { name: "Préstamos" } }])
      ).toBe(true);
      expect(
        hasActiveLoanRequest([{ status: "aprobado", request_types: { name: "Préstamos" } }])
      ).toBe(true);
    });

    it("no bloquea si el préstamo está completado o rechazado", () => {
      expect(
        hasActiveLoanRequest([{ status: "completado", request_types: { name: "Préstamo" } }])
      ).toBe(false);
      expect(
        hasActiveLoanRequest([{ status: "rechazado", request_types: { name: "Préstamo" } }])
      ).toBe(false);
    });

    it("no bloquea si la solicitud activa no es un préstamo", () => {
      expect(
        hasActiveLoanRequest([{ status: "pendiente", request_types: { name: "Auto de reemplazo" } }])
      ).toBe(false);
    });
  });

  describe("validateLoanRequest", () => {
    it("rechaza si el conductor tiene menos de 8 estrellas", () => {
      const res = validateLoanRequest({
        score: 7,
        estadoConductor: "nuevo",
        amount: 200000,
        cuotas: 3,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("8 o más estrellas");
    });

    it("rechaza si tiene un préstamo activo", () => {
      const res = validateLoanRequest({
        score: 9,
        estadoConductor: "antiguo",
        amount: 300000,
        cuotas: 4,
        hasActiveLoan: true,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("préstamo en curso");
    });

    it("valida conductor nuevo en rango $100.000 a $300.000", () => {
      // Mínimo
      expect(
        validateLoanRequest({ score: 8, estadoConductor: "nuevo", amount: 50000, cuotas: 3 }).valid
      ).toBe(false);

      // Correcto
      expect(
        validateLoanRequest({ score: 8, estadoConductor: "nuevo", amount: 250000, cuotas: 5 }).valid
      ).toBe(true);

      // Supera $300.000
      expect(
        validateLoanRequest({ score: 8, estadoConductor: "nuevo", amount: 350000, cuotas: 5 }).valid
      ).toBe(false);
    });

    it("valida conductor antiguo en rango estándar $100.000 a $500.000", () => {
      expect(
        validateLoanRequest({ score: 9, estadoConductor: "antiguo", amount: 500000, cuotas: 6 }).valid
      ).toBe(true);

      // Si supera 500.000 sin solicitud especial, se rechaza
      const resNoSpecial = validateLoanRequest({
        score: 9,
        estadoConductor: "antiguo",
        amount: 700000,
        cuotas: 6,
        isSpecialRequested: false,
      });
      expect(resNoSpecial.valid).toBe(false);
      expect(resNoSpecial.error).toContain("Solicitud Especial");
    });

    it("permite hasta $1.000.000 para conductor antiguo con solicitud especial", () => {
      const resSpecial = validateLoanRequest({
        score: 9,
        estadoConductor: "antiguo",
        amount: 800000,
        cuotas: 6,
        isSpecialRequested: true,
      });
      expect(resSpecial.valid).toBe(true);
      expect(resSpecial.isSpecialRequest).toBe(true);

      // Supera 1 millón
      const resOverMillion = validateLoanRequest({
        score: 9,
        estadoConductor: "antiguo",
        amount: 1200000,
        cuotas: 6,
        isSpecialRequested: true,
      });
      expect(resOverMillion.valid).toBe(false);
    });

    it("no permite solicitud especial a conductor nuevo", () => {
      const res = validateLoanRequest({
        score: 10,
        estadoConductor: "nuevo",
        amount: 500000,
        cuotas: 6,
        isSpecialRequested: true,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("$300.000");
    });
  });

  describe("isLoanRequestType", () => {
    it("detecta variaciones de préstamo", () => {
      expect(isLoanRequestType("Préstamo")).toBe(true);
      expect(isLoanRequestType("préstamos")).toBe(true);
      expect(isLoanRequestType("Prestamo")).toBe(true);
      expect(isLoanRequestType("Vacaciones")).toBe(false);
    });
  });

  describe("buildLoanDetails", () => {
    it("construye el texto con desglose y recargo", () => {
      const breakdown = calculateLoanBreakdown(200000, 4);
      const text = buildLoanDetails({
        breakdown,
        motivo: "Emergencia médica",
        isSpecial: false,
        estadoConductor: "nuevo",
      });
      expect(text).toContain("SOLICITUD DE PRÉSTAMO");
      expect(text).toContain("• Recargo (20%): +$40.000");
      expect(text).toContain("• Total a pagar: $240.000");
      expect(text).toContain("4 cuota(s) de $60.000");
      expect(text).toContain("Emergencia médica");
    });
  });
});

