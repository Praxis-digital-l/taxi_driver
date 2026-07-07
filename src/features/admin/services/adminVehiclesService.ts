import { supabase } from "@/integrations/supabase/client";

export type VehicleRecord = {
  id: string;
  license_plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  status: string;
};

export type ConductorRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type VehicleAssignmentRecord = {
  id: string;
  vehicle_id: string;
  profile_id: string;
  assigned_at: string;
  profiles?: { full_name: string | null } | null;
  vehicles?: { license_plate: string | null } | null;
};

export type CreateVehiclePayload = {
  licensePlate: string;
  make: string;
  model: string;
  year: number | null;
  color: string;
};

function assertNoError(error: { message: string; code?: string; details?: string | null } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminVehiclesData() {
  const [vehiclesRes, conductorsRes, assignmentsRes] = await Promise.all([
    supabase.from("vehicles").select("id, license_plate, make, model, year, color, status").order("license_plate", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "conductor").order("full_name", { ascending: true }),
    supabase
      .from("vehicle_assignments")
      .select("id, vehicle_id, profile_id, assigned_at, profiles(full_name), vehicles(license_plate)")
      .order("assigned_at", { ascending: false }),
  ]);

  assertNoError(vehiclesRes.error);
  assertNoError(conductorsRes.error);
  assertNoError(assignmentsRes.error);

  return {
    vehicles: (vehiclesRes.data ?? []) as VehicleRecord[],
    conductors: (conductorsRes.data ?? []) as ConductorRecord[],
    assignments: (assignmentsRes.data ?? []) as VehicleAssignmentRecord[],
  };
}

export async function createVehicle(payload: CreateVehiclePayload) {
  const { error } = await supabase.from("vehicles").insert({
    license_plate: payload.licensePlate.trim().toUpperCase(),
    make: payload.make.trim(),
    model: payload.model.trim(),
    year: payload.year,
    color: payload.color.trim(),
  });

  assertNoError(error);
}

export async function assignConductorToVehicle(vehicleId: string, profileId: string) {
  const { error } = await supabase.from("vehicle_assignments").insert({
    vehicle_id: vehicleId,
    profile_id: profileId,
  });

  if (error?.code === "23505") {
    throw new Error("Este conductor ya está asignado a este vehículo.");
  }

  assertNoError(error);
}

export async function removeVehicleAssignment(assignmentId: string) {
  const { error } = await supabase.from("vehicle_assignments").delete().eq("id", assignmentId);
  assertNoError(error);
}

function isVehicleAssignmentReference(error: { message: string; details?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return message.includes("vehicle_assignments");
}

export async function deleteVehicleById(vehicleId: string) {
  const firstAttempt = await supabase.from("vehicles").delete().eq("id", vehicleId);

  if (!firstAttempt.error) {
    return;
  }

  if (firstAttempt.error.code === "23503" && isVehicleAssignmentReference(firstAttempt.error)) {
    const deleteAssignments = await supabase.from("vehicle_assignments").delete().eq("vehicle_id", vehicleId);
    assertNoError(deleteAssignments.error);

    const secondAttempt = await supabase.from("vehicles").delete().eq("id", vehicleId);
    assertNoError(secondAttempt.error);
    return;
  }

  assertNoError(firstAttempt.error);
}
