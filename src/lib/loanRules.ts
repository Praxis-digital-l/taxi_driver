/**
 * Reglas de negocio para Préstamos a Conductores.
 *
 * Requerimientos:
 * 1. Solo pueden solicitar préstamos conductores con 8 o más estrellas (score >= 8).
 * 2. El Préstamo tiene un recargo del 20%, resaltado con confirmación explícita.
 * 3. Máximo hasta 6 cuotas (1 a 6).
 * 4. Bloqueo si existen cuotas pendientes o un préstamo en curso (status 'pendiente', 'en_proceso', 'aprobado').
 * 5. Rangos según antigüedad:
 *    - Conductor Nuevo (8+ estrellas): Mínimo $100.000 hasta $300.000 (hasta 6 cuotas).
 *    - Conductor Antiguo (8+ estrellas): Mínimo $100.000 hasta $500.000 estándar.
 *      Si necesita más dinero hasta $1.000.000: Solicitud Especial (hasta 6 cuotas).
 */

export const MIN_LOAN_SCORE = 8;
export const LOAN_SURCHARGE_PERCENT = 20;
export const MIN_LOAN_CUOTAS = 1;
export const MAX_LOAN_CUOTAS = 6;

export const LOAN_LIMITS = {
  nuevo: {
    min: 100000,
    maxStandard: 300000,
    maxSpecial: 300000,
    allowsSpecial: false,
    label: "Conductor Nuevo",
  },
  antiguo: {
    min: 100000,
    maxStandard: 500000,
    maxSpecial: 1000000,
    allowsSpecial: true,
    label: "Conductor Antiguo",
  },
} as const;

export type EstadoConductor = "nuevo" | "antiguo";

export interface LoanBreakdown {
  montoSolicitado: number;
  recargoPorcentaje: number;
  recargoMonto: number;
  totalConRecargo: number;
  cuotas: number;
  valorCuota: number;
}

export function isLoanRequestType(typeName?: string | null): boolean {
  if (!typeName) return false;
  const normalized = typeName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return normalized.includes("prestamo");
}

export function calculateLoanBreakdown(amount: number, cuotas: number): LoanBreakdown {
  const montoSolicitado = Math.max(0, Number(amount) || 0);
  const safeCuotas = Math.min(MAX_LOAN_CUOTAS, Math.max(MIN_LOAN_CUOTAS, Number(cuotas) || 1));
  const recargoMonto = Math.round(montoSolicitado * (LOAN_SURCHARGE_PERCENT / 100));
  const totalConRecargo = montoSolicitado + recargoMonto;
  const valorCuota = safeCuotas > 0 ? Math.round(totalConRecargo / safeCuotas) : totalConRecargo;

  return {
    montoSolicitado,
    recargoPorcentaje: LOAN_SURCHARGE_PERCENT,
    recargoMonto,
    totalConRecargo,
    cuotas: safeCuotas,
    valorCuota,
  };
}

export function hasActiveLoanRequest(requests: Array<{ status?: string | null; request_types?: { name?: string | null } | null }>): boolean {
  const ACTIVE_STATUSES = ["pendiente", "en_proceso", "aprobado"];
  return requests.some((r) => {
    const isLoan = isLoanRequestType(r.request_types?.name);
    const isActive = ACTIVE_STATUSES.includes(r.status ?? "");
    return isLoan && isActive;
  });
}

export interface LoanValidationResult {
  valid: boolean;
  error?: string;
  isSpecialRequest?: boolean;
}

export function validateLoanRequest(params: {
  score?: number | null;
  estadoConductor?: string | null;
  amount: number;
  cuotas: number;
  isSpecialRequested?: boolean;
  hasActiveLoan?: boolean;
}): LoanValidationResult {
  const { score, estadoConductor, amount, cuotas, isSpecialRequested, hasActiveLoan } = params;

  // 1. Estrellas
  const safeScore = Number(score ?? 0);
  if (safeScore < MIN_LOAN_SCORE) {
    return {
      valid: false,
      error: `Solo pueden solicitar un préstamo conductores con ${MIN_LOAN_SCORE} o más estrellas. Tu puntuación actual es de ${safeScore} estrellas.`,
    };
  }

  // 2. Préstamo activo
  if (hasActiveLoan) {
    return {
      valid: false,
      error: "No puedes solicitar un préstamo si existen cuotas pendientes o un préstamo en curso. Debes finalizar el préstamo actual antes de solicitar uno nuevo.",
    };
  }

  // 3. Cuotas
  if (cuotas < MIN_LOAN_CUOTAS || cuotas > MAX_LOAN_CUOTAS) {
    return {
      valid: false,
      error: `Los préstamos pueden ser hasta en ${MAX_LOAN_CUOTAS} cuotas máximo.`,
    };
  }

  // 4. Monto
  const estado: EstadoConductor = estadoConductor === "antiguo" ? "antiguo" : "nuevo";
  const limits = LOAN_LIMITS[estado];

  if (amount < limits.min) {
    return {
      valid: false,
      error: `El monto mínimo para solicitar un préstamo es de $${limits.min.toLocaleString("es-CL")}.`,
    };
  }

  if (estado === "nuevo") {
    if (amount > limits.maxStandard) {
      return {
        valid: false,
        error: `Para conductores nuevos con 8 o más estrellas el rango de préstamos es de hasta $${limits.maxStandard.toLocaleString("es-CL")}.`,
      };
    }
    return { valid: true, isSpecialRequest: false };
  }

  // Conductor antiguo
  if (amount > limits.maxStandard) {
    if (amount > limits.maxSpecial) {
      return {
        valid: false,
        error: `El monto máximo permitido en solicitud especial es de $${limits.maxSpecial.toLocaleString("es-CL")}.`,
      };
    }
    if (!isSpecialRequested && amount > limits.maxStandard) {
      return {
        valid: false,
        error: `Los préstamos de más de $${limits.maxStandard.toLocaleString("es-CL")} hasta $${limits.maxSpecial.toLocaleString("es-CL")} requieren activar la opción de Solicitud Especial.`,
      };
    }
    return { valid: true, isSpecialRequest: true };
  }

  return { valid: true, isSpecialRequest: isSpecialRequested ?? false };
}

export function buildLoanDetails(params: {
  breakdown: LoanBreakdown;
  motivo?: string;
  isSpecial?: boolean;
  estadoConductor?: string;
}): string {
  const { breakdown, motivo, isSpecial, estadoConductor } = params;
  const lines: string[] = [];

  if (isSpecial) {
    lines.push("★ SOLICITUD ESPECIAL DE PRÉSTAMO (Conductor Antiguo)");
  } else {
    lines.push("SOLICITUD DE PRÉSTAMO");
  }

  lines.push(`• Conductor: ${estadoConductor === "antiguo" ? "Antiguo" : "Nuevo"}`);
  lines.push(`• Monto solicitado: $${breakdown.montoSolicitado.toLocaleString("es-CL")}`);
  lines.push(`• Recargo (20%): +$${breakdown.recargoMonto.toLocaleString("es-CL")}`);
  lines.push(`• Total a pagar: $${breakdown.totalConRecargo.toLocaleString("es-CL")}`);
  lines.push(`• Cuotas: ${breakdown.cuotas} cuota(s) de $${breakdown.valorCuota.toLocaleString("es-CL")}`);

  if (motivo?.trim()) {
    lines.push("");
    lines.push(`Motivo/Detalles: ${motivo.trim()}`);
  }

  return lines.join("\n");
}

