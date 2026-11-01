import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_LOAN_SURCHARGE_PERCENT = 20;

export function normalizeLoanSurchargePercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LOAN_SURCHARGE_PERCENT;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

export async function fetchLoanSurchargePercent(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("get_prestamo_recargo_porcentaje");
    if (error) throw new Error(error.message);
    return normalizeLoanSurchargePercent(data);
  } catch {
    return DEFAULT_LOAN_SURCHARGE_PERCENT;
  }
}

export async function updateLoanSurchargePercent(percent: number): Promise<number> {
  const normalized = normalizeLoanSurchargePercent(percent);
  const { data, error } = await supabase.rpc("set_prestamo_recargo_porcentaje", {
    p_porcentaje: normalized,
  });
  if (error) throw new Error(error.message);
  return normalizeLoanSurchargePercent(data);
}
