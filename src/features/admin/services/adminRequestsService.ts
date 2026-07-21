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
    .select("id, profile_id, request_type_id, status, details, amount, created_at, vehicle_id, request_types(name), profiles(full_name, rut, phone), vehicles(license_plate)")
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

export async function updateAdminRequestStatus(requestId: string, status: string) {
  const { error } = await supabase.from("requests").update({ status }).eq("id", requestId);
  assertNoError(error);
}

export async function updateRequest(requestId: string, updates: {
  request_type_id?: string;
  vehicle_id?: string | null;
  amount?: number | null;
  details?: string;
}) {
  const { error } = await supabase.from("requests").update(updates).eq("id", requestId);
  assertNoError(error);
}

export async function deleteRequest(requestId: string) {
  const { error } = await supabase.from("requests").delete().eq("id", requestId);
  assertNoError(error);
}

export function sortActiveRequestsByPriority(requests: AdminRequest[]) {
  return sortRequestsByPriority(
    requests,
    (request) => request.request_types?.name,
    (request) => request.created_at,
  );
}
