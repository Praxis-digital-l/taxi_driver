import { supabase } from "@/integrations/supabase/client";
import { sortRequestsByPriority } from "@/lib/requestPriority";

export type AdminRequest = {
  id: string;
  profile_id: string;
  request_type_id: string;
  status: string;
  details: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
  vehicle_id: string | null;
  request_types?: { name: string | null } | null;
  profiles?: { full_name: string | null; rut: string | null; phone: string | null } | null;
  vehicles?: { license_plate: string | null } | null;
};

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminRequests(statusFilter: string) {
  let query = supabase
    .from("requests")
    .select("id, profile_id, request_type_id, status, details, amount, created_at, updated_at, vehicle_id, request_types(name), profiles(full_name, rut, phone), vehicles(license_plate)")
    .limit(200);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  assertNoError(error);

  const requests = (data ?? []) as AdminRequest[];
  return sortRequestsByPriority(
    requests,
    (request) => request.request_types?.name,
    (request) => request.created_at,
  );
}

async function syncVacationStatus(requestId: string, status: string, reason?: string) {
  try {
    const { data: req } = await supabase
      .from("requests")
      .select("profile_id, details")
      .eq("id", requestId)
      .single();

    if (!req?.details || (!req.details.includes("[VACACIONES") && !req.details.includes("[SOLICITUD DE VACACIONES"))) {
      return;
    }

    const matchDates = req.details.match(/Salida:\s*(\d{4}-\d{2}-\d{2})\s*·\s*Retorno:\s*(\d{4}-\d{2}-\d{2})/);
    const startDate = matchDates ? matchDates[1] : null;
    const endDate = matchDates ? matchDates[2] : null;

    let targetVacationQuery = supabase
      .from("conductor_vacations")
      .update({
        status: status === "aprobado" ? "programada" : "cancelada",
        notes:
          status === "rechazado"
            ? `Rechazado por administración: ${reason || "Sin motivo especificado"}`
            : "Aprobado por administración.",
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", req.profile_id);

    if (startDate && endDate) {
      targetVacationQuery = targetVacationQuery.eq("start_date", startDate).eq("end_date", endDate);
    }

    await targetVacationQuery;
  } catch (err) {
    console.warn("No se pudo sincronizar conductor_vacations:", err);
  }
}

export async function updateAdminRequestStatus(requestId: string, status: string) {
  const { error } = await supabase.from("requests").update({ status }).eq("id", requestId);
  assertNoError(error);
  await syncVacationStatus(requestId, status);
}

export async function resolveRequest(requestId: string, status: string, reason?: string) {
  const { data: current } = await supabase
    .from("requests")
    .select("details")
    .eq("id", requestId)
    .single();

  let newDetails = current?.details ?? "";
  if (status === "rechazado" && reason) {
    const dateStr = new Date().toLocaleString("es-CL");
    const resolution = `\n\n--- MOTIVO DEL RECHAZO (${dateStr}) ---\n${reason}`;
    newDetails = (newDetails || "") + resolution;
  }

  const { error } = await supabase
    .from("requests")
    .update({ status, details: newDetails })
    .eq("id", requestId);
  assertNoError(error);
  await syncVacationStatus(requestId, status, reason);
}

export async function updateRequest(requestId: string, updates: {
  request_type_id?: string;
  vehicle_id?: string | null;
  amount?: number | null;
  details?: string;
}) {
  const { data, error } = await supabase.from("requests").update(updates).eq("id", requestId).select();
  assertNoError(error);
  if (!data || data.length === 0) {
    throw new Error("No se pudo guardar la solicitud. Verifica que exista o que tengas permisos para editarla.");
  }
}

export async function deleteRequest(requestId: string) {
  const { data, error } = await supabase.from("requests").delete().eq("id", requestId).select();
  assertNoError(error);
  if (!data || data.length === 0) {
    throw new Error("No se pudo eliminar la solicitud. Verifica que exista o que tengas permisos.");
  }
}

export function sortActiveRequestsByPriority(requests: AdminRequest[]) {
  return sortRequestsByPriority(
    requests,
    (request) => request.request_types?.name,
    (request) => request.created_at,
  );
}
