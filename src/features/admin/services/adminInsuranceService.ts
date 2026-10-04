import { supabase } from "@/integrations/supabase/client";

export type InsuranceType = "obligatorio" | "comercial" | "asiento" | "otro";
export type InsurancePaymentStatus = "pendiente" | "pagado";

export type AdminInsurance = {
  id: string;
  vehicle_id: string;
  insurance_type: InsuranceType;
  custom_insurance_name?: string | null;
  amount: number;
  expiration_date: string;
  payment_status: InsurancePaymentStatus;
  last_payment_date: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: { license_plate: string | null } | null;
};

export type AdminExpiringInsurance = AdminInsurance & {
  vehicles?: { license_plate: string | null } | null;
};

export const INSURANCE_TYPES: { value: InsuranceType; label: string }[] = [
  { value: "obligatorio", label: "Obligatorio (SOAP)" },
  { value: "comercial", label: "Comercial" },
  { value: "asiento", label: "De asiento" },
  { value: "otro", label: "Otro" },
];

export const INSURANCE_TYPE_LABEL: Record<InsuranceType, string> = {
  obligatorio: "Obligatorio (SOAP)",
  comercial: "Comercial",
  asiento: "De asiento",
  otro: "Otro",
};

export const isInsuranceExpired = (insurance: Pick<AdminInsurance, "payment_status" | "expiration_date">) =>
  insurance.payment_status === "pendiente" &&
  new Date(insurance.expiration_date).getTime() < Date.now();

export const isInsuranceExpiring = (
  expirationDate: string | null,
  thresholdDays = 60,
) => {
  if (!expirationDate) {
    return false;
  }
  const diff = new Date(expirationDate).getTime() - Date.now();
  return diff > 0 && diff < thresholdDays * 86400000;
};

export const getInsuranceDaysLeft = (expirationDate: string) =>
  Math.ceil((new Date(expirationDate).getTime() - Date.now()) / 86400000);

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchInsurancesByVehicle(vehicleId: string): Promise<AdminInsurance[]> {
  const { data, error } = await supabase
    .from("vehicle_insurances")
    .select("id, vehicle_id, insurance_type, custom_insurance_name, amount, expiration_date, payment_status, last_payment_date, created_at, updated_at")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as AdminInsurance[];
}

export async function fetchInsuranceByVehicle(vehicleId: string): Promise<AdminInsurance | null> {
  const list = await fetchInsurancesByVehicle(vehicleId);
  return list[0] ?? null;
}

export async function saveVehicleInsurance(params: {
  id?: string;
  vehicleId: string;
  insuranceType: InsuranceType;
  customInsuranceName?: string | null;
  amount: number;
  expirationDate: string;
  paymentStatus: InsurancePaymentStatus;
}) {
  const { id, vehicleId, insuranceType, customInsuranceName, amount, expirationDate, paymentStatus } = params;

  let lastPaymentDate: string | null = paymentStatus === "pagado" ? new Date().toISOString().slice(0, 10) : null;

  if (id) {
    const { data: existing } = await supabase
      .from("vehicle_insurances")
      .select("payment_status, last_payment_date")
      .eq("id", id)
      .maybeSingle();

    if (existing && existing.payment_status === "pagado" && paymentStatus === "pagado") {
      lastPaymentDate = existing.last_payment_date;
    }
  }

  const values = {
    insurance_type: insuranceType,
    custom_insurance_name: insuranceType === "otro" ? customInsuranceName?.trim() || null : null,
    amount,
    expiration_date: expirationDate,
    payment_status: paymentStatus,
    last_payment_date: lastPaymentDate,
  };

  if (id) {
    const { error } = await supabase
      .from("vehicle_insurances")
      .update(values)
      .eq("id", id);
    assertNoError(error);
    return;
  }

  const { error } = await supabase.from("vehicle_insurances").insert({
    vehicle_id: vehicleId,
    ...values,
  });
  assertNoError(error);
}

export async function markInsurancePaid(insuranceId: string) {
  const { error } = await supabase
    .from("vehicle_insurances")
    .update({
      payment_status: "pagado",
      last_payment_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", insuranceId);

  assertNoError(error);
}

export async function deleteVehicleInsurance(insuranceId: string) {
  const { error } = await supabase
    .from("vehicle_insurances")
    .delete()
    .eq("id", insuranceId);

  assertNoError(error);
}