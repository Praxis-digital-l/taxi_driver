import { describe, expect, it } from "vitest";
import {
  MIN_BENEFIT_SCORE,
  canRequestType,
  getAvailableRequestTypes,
  getBenefitTypes,
  getRequiredScore,
  isBenefitType,
  normalizeScore,
  type RequestTypeWithScore,
} from "./requestBenefits";

const types: RequestTypeWithScore[] = [
  { id: "1", name: "Combustible", min_score: 0 },
  { id: "2", name: "Préstamos", min_score: 8 },
  { id: "3", name: "Auto de reemplazo", min_score: 8 },
  { id: "4", name: "Vacaciones" },
];

describe("requestBenefits", () => {
  it("normaliza puntajes nulos o inválidos a 0", () => {
    expect(normalizeScore(null)).toBe(0);
    expect(normalizeScore(undefined)).toBe(0);
    expect(normalizeScore(Number.NaN)).toBe(0);
    expect(normalizeScore(8)).toBe(8);
  });

  it("considera beneficio a cualquier tipo con min_score mayor a 0", () => {
    expect(isBenefitType(types[0])).toBe(false);
    expect(isBenefitType(types[1])).toBe(true);
    expect(isBenefitType(types[3])).toBe(false);
    expect(getRequiredScore(types[1])).toBe(8);
    expect(getRequiredScore(types[3])).toBe(0);
  });

  it("oculta los beneficios a conductores con menos de 8 estrellas", () => {
    const available = getAvailableRequestTypes(types, 7).map((t) => t.name);
    expect(available).toEqual(["Combustible", "Vacaciones"]);
    expect(getBenefitTypes(types, 7)).toEqual([]);
  });

  it("muestra los beneficios cuando el conductor tiene 8 o más estrellas", () => {
    const available = getAvailableRequestTypes(types, MIN_BENEFIT_SCORE).map((t) => t.name);
    expect(available).toEqual(["Combustible", "Préstamos", "Auto de reemplazo", "Vacaciones"]);
    expect(getBenefitTypes(types, 8).map((t) => t.name)).toEqual(["Préstamos", "Auto de reemplazo"]);
  });

  it("trata el puntaje nulo como 0 (sin acceso a beneficios)", () => {
    expect(canRequestType(null, types[1])).toBe(false);
    expect(canRequestType(8, types[1])).toBe(true);
  });
});
