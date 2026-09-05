import { supabase } from "@/integrations/supabase/client";
import {
  type PartCondition,
  type VehicleObservation,
  VEHICLE_PARTS,
} from "../types/vehicleInspection";

export async function fetchVehicleObservations(vehicleId: string): Promise<VehicleObservation[]> {
  const { data, error } = await supabase
    .from("vehicle_observations")
    .select("*, profiles(id, full_name, role, email)")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener observaciones de Supabase:", error);
    // Si la tabla aún no existe o devuelve 404, retornar lista vacía mientras se ejecuta la migración
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return [];
    }
    return [];
  }

  return (data as unknown as VehicleObservation[]) || [];
}

export async function createVehicleObservation(payload: {
  vehicleId: string;
  profileId: string;
  partKey: string;
  partName: string;
  condition: PartCondition;
  issueType: string;
  description: string;
}): Promise<VehicleObservation> {
  const { data, error } = await supabase
    .from("vehicle_observations")
    .insert({
      vehicle_id: payload.vehicleId,
      profile_id: payload.profileId,
      part_key: payload.partKey,
      part_name: payload.partName,
      condition: payload.condition,
      issue_type: payload.issueType,
      description: payload.description,
      status: "pendiente",
    })
    .select("*, profiles(id, full_name, role, email)")
    .single();

  if (error) {
    console.error("Error al insertar observación en Supabase:", error);
    if (error.code === "42P01" || error.message?.includes("does not exist") || (error as any).status === 404) {
      throw new Error(
        "Falta crear la tabla en Supabase. Abre el SQL Editor en Supabase y ejecuta el script 'supabase/vehicle_observations.sql'."
      );
    }
    throw new Error(error.message || "Error al insertar en la base de datos");
  }

  return data as unknown as VehicleObservation;
}

export async function updateObservationStatus(
  observationId: string,
  newStatus: "pendiente" | "en_revision" | "reparado",
): Promise<void> {
  const { error } = await supabase
    .from("vehicle_observations")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", observationId);

  if (error) {
    console.error("Error al actualizar observación en Supabase:", error);
    throw error;
  }
}

export async function deleteVehicleObservation(observationId: string): Promise<void> {
  const { error } = await supabase
    .from("vehicle_observations")
    .delete()
    .eq("id", observationId);

  if (error) {
    console.error("Error al eliminar observación en Supabase:", error);
    throw error;
  }
}

export interface VehicleHealthSummary {
  overallScore: number;
  totalObservations: number;
  activeIssuesCount: number;
  partStatusMap: Record<string, PartCondition>;
  categoryStatusMap: Record<string, PartCondition>;
}

export function calculateVehicleHealth(observations: VehicleObservation[]): VehicleHealthSummary {
  const activeObs = observations.filter((obs) => obs.status !== "reparado");
  const partStatusMap: Record<string, PartCondition> = {};

  for (const part of VEHICLE_PARTS) {
    partStatusMap[part.key] = "good";
  }

  for (const obs of activeObs) {
    const current = partStatusMap[obs.part_key] || "good";
    if (obs.condition === "damaged") {
      partStatusMap[obs.part_key] = "damaged";
    } else if (obs.condition === "warning" && current !== "damaged") {
      partStatusMap[obs.part_key] = "warning";
    }
  }

  const categoryStatusMap: Record<string, PartCondition> = {};
  for (const part of VEHICLE_PARTS) {
    const partCond = partStatusMap[part.key];
    const cat = part.category;
    const currentCat = categoryStatusMap[cat] || "good";

    if (partCond === "damaged") {
      categoryStatusMap[cat] = "damaged";
    } else if (partCond === "warning" && currentCat !== "damaged") {
      categoryStatusMap[cat] = "warning";
    }
  }

  let deduction = 0;
  for (const partKey in partStatusMap) {
    if (partStatusMap[partKey] === "damaged") {
      deduction += 9;
    } else if (partStatusMap[partKey] === "warning") {
      deduction += 4;
    }
  }

  const overallScore = Math.max(15, Math.min(100, Math.round(100 - deduction)));

  return {
    overallScore,
    totalObservations: observations.length,
    activeIssuesCount: activeObs.length,
    partStatusMap,
    categoryStatusMap,
  };
}

