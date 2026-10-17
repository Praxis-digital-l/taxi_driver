/**
 * Reglas de acceso a los beneficios por puntaje del conductor.
 *
 * Un tipo de solicitud (`request_types`) con `min_score > 0` es un beneficio:
 * solo se muestra (y se puede solicitar) cuando el conductor alcanza ese
 * puntaje mínimo de estrellas. Los tipos con `min_score = 0` están disponibles
 * para todos.
 */

export const MIN_BENEFIT_SCORE = 8;

export type RequestTypeWithScore = {
  id: string;
  name: string;
  min_score?: number | null;
};

type ScoreCarrier = { min_score?: number | null } | null | undefined;

/** Normaliza el puntaje del conductor: valores nulos o inválidos valen 0. */
export function normalizeScore(score: number | null | undefined): number {
  const value = Number(score ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** Puntaje mínimo requerido por un tipo (0 = disponible para todos). */
export function getRequiredScore(type: ScoreCarrier): number {
  const value = Number(type?.min_score ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Un tipo es un "beneficio" cuando exige un puntaje mínimo. */
export function isBenefitType(type: ScoreCarrier): boolean {
  return getRequiredScore(type) > 0;
}

/** Indica si un conductor puede ver y solicitar un tipo según su puntaje. */
export function canRequestType(
  score: number | null | undefined,
  type: ScoreCarrier,
): boolean {
  return normalizeScore(score) >= getRequiredScore(type);
}

/** Tipos de solicitud visibles para el conductor según su puntaje. */
export function getAvailableRequestTypes<T extends RequestTypeWithScore>(
  types: T[],
  score: number | null | undefined,
): T[] {
  return types.filter((type) => canRequestType(score, type));
}

/** Beneficios que el conductor ya puede solicitar (requieren 8+ estrellas). */
export function getBenefitTypes<T extends RequestTypeWithScore>(
  types: T[],
  score: number | null | undefined,
): T[] {
  return types.filter((type) => isBenefitType(type) && canRequestType(score, type));
}
