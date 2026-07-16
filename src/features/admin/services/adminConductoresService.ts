import { supabase } from "@/integrations/supabase/client";

export type ConductorRecord = {
  id: string;
  user_id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  full_name: string;
  email: string;
  phone: string | null;
  rut: string;
  estado_conductor: string;
  role: string;
  created_at: string;
  updated_at: string;
};

export type ConductorVehicleRecord = {
  id: string;
  vehicle_id: string;
  profile_id: string;
  assigned_at: string;
  vehicles?: { id: string; license_plate: string; make: string; model: string; year: number | null; color: string | null } | null;
};

export type ConductorDetailRecord = ConductorRecord & {
  vehicles: ConductorVehicleRecord[];
};

export type CreateConductorPayload = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  phone: string;
  rut: string;
  password: string;
};

export type UpdateConductorPayload = {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email?: string;
  phone?: string;
  rut?: string;
  estado_conductor?: string;
};

function assertNoError(error: { message: string; code?: string; details?: string | null } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminConductores() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, nombres, apellido_paterno, apellido_materno, full_name, email, phone, rut, estado_conductor, role, created_at, updated_at")
    .eq("role", "conductor")
    .order("full_name", { ascending: true });

  assertNoError(error);
  return (data ?? []) as ConductorRecord[];
}

export async function fetchConductorDetail(id: string) {
  const { data: conductor, error: conductorError } = await supabase
    .from("profiles")
    .select("id, user_id, nombres, apellido_paterno, apellido_materno, full_name, email, phone, rut, estado_conductor, role, created_at, updated_at")
    .eq("id", id)
    .single();

  assertNoError(conductorError);

  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vehicle_assignments")
    .select("id, vehicle_id, profile_id, assigned_at, vehicles(id, license_plate, make, model, year, color)")
    .eq("profile_id", id)
    .order("assigned_at", { ascending: false });

  assertNoError(vehiclesError);

  return {
    ...(conductor as ConductorRecord),
    vehicles: (vehicles ?? []) as ConductorVehicleRecord[],
  } as ConductorDetailRecord;
}

export async function createConductor(payload: CreateConductorPayload) {
  const fullName = `${payload.nombres.trim()} ${payload.apellidoPaterno.trim()} ${payload.apellidoMaterno.trim()}`.trim();

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: {
      data: {
        full_name: fullName,
        nombres: payload.nombres.trim(),
        apellido_paterno: payload.apellidoPaterno.trim(),
        apellido_materno: payload.apellidoMaterno.trim(),
      },
    },
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  if (!authData.user) {
    throw new Error("No se pudo crear el usuario de autenticación");
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      nombres: payload.nombres.trim(),
      apellido_paterno: payload.apellidoPaterno.trim(),
      apellido_materno: payload.apellidoMaterno.trim(),
      phone: payload.phone.trim(),
      rut: payload.rut.trim(),
    })
    .eq("user_id", authData.user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function updateConductor(id: string, payload: UpdateConductorPayload) {
  const updateData: Record<string, string> = {};

  if (payload.nombres !== undefined) updateData.nombres = payload.nombres.trim();
  if (payload.apellidoPaterno !== undefined) updateData.apellido_paterno = payload.apellidoPaterno.trim();
  if (payload.apellidoMaterno !== undefined) updateData.apellido_materno = payload.apellidoMaterno.trim();
  if (payload.email !== undefined) updateData.email = payload.email.trim().toLowerCase();
  if (payload.phone !== undefined) updateData.phone = payload.phone.trim();
  if (payload.rut !== undefined) updateData.rut = payload.rut.trim();
  if (payload.estado_conductor !== undefined) updateData.estado_conductor = payload.estado_conductor;

  const { error } = await supabase.from("profiles").update(updateData).eq("id", id);
  assertNoError(error);
}

export const ESTADO_CONDUCTOR_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "antiguo", label: "Antiguo" },
  { value: "desactivado", label: "Desactivado" },
] as const;

export const ESTADO_CONDUCTOR_STYLES: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-800 border-blue-200",
  antiguo: "bg-accent/10 text-accent border-accent/20",
  desactivado: "bg-destructive/10 text-destructive border-destructive/20",
};

export const ESTADO_CONDUCTOR_LABELS: Record<string, string> = {
  nuevo: "Nuevo",
  antiguo: "Antiguo",
  desactivado: "Desactivado",
};
