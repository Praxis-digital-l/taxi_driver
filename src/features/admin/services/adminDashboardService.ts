import { supabase } from "@/integrations/supabase/client";
import { sortActiveRequestsByPriority, type AdminRequest } from "@/features/admin/services/adminRequestsService";

export type AdminDashboardStats = {
  vehicles: number;
  activeVehicles: number;
  conductors: number;
  pendingRequests: number;
  inProcessRequests: number;
  expiringDocs: number;
  totalDocs: number;
  unreadMessages: number;
};

export type AdminExpiringDocument = {
  id: string;
  expiration_date: string;
  document_types?: { name: string | null } | null;
  profiles?: { full_name: string | null } | null;
  vehicles?: { license_plate: string | null } | null;
};

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminDashboardData() {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [
    vehiclesRes,
    activeVehiclesRes,
    conductorsRes,
    pendingRequestsRes,
    inProcessRequestsRes,
    expiringDocumentsRes,
    totalDocumentsRes,
    unreadMessagesRes,
    activeRequestsRes,
    expiringDocumentsListRes,
  ] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "conductor"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "en_proceso"),
    supabase.from("documents").select("id", { count: "exact", head: true }).lte("expiration_date", thirtyDays).gte("expiration_date", today),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
    supabase
      .from("requests")
      .select("id, status, details, amount, created_at, request_types(name), profiles(full_name), vehicles(license_plate)")
      .in("status", ["pendiente", "en_proceso"])
      .limit(50),
    supabase
      .from("documents")
      .select("id, expiration_date, document_types(name), profiles(full_name), vehicles(license_plate)")
      .lte("expiration_date", thirtyDays)
      .gte("expiration_date", today)
      .order("expiration_date", { ascending: true })
      .limit(5),
  ]);

  assertNoError(vehiclesRes.error);
  assertNoError(activeVehiclesRes.error);
  assertNoError(conductorsRes.error);
  assertNoError(pendingRequestsRes.error);
  assertNoError(inProcessRequestsRes.error);
  assertNoError(expiringDocumentsRes.error);
  assertNoError(totalDocumentsRes.error);
  assertNoError(unreadMessagesRes.error);
  assertNoError(activeRequestsRes.error);
  assertNoError(expiringDocumentsListRes.error);

  const stats: AdminDashboardStats = {
    vehicles: vehiclesRes.count || 0,
    activeVehicles: activeVehiclesRes.count || 0,
    conductors: conductorsRes.count || 0,
    pendingRequests: pendingRequestsRes.count || 0,
    inProcessRequests: inProcessRequestsRes.count || 0,
    expiringDocs: expiringDocumentsRes.count || 0,
    totalDocs: totalDocumentsRes.count || 0,
    unreadMessages: unreadMessagesRes.count || 0,
  };

  const activeRequests = sortActiveRequestsByPriority((activeRequestsRes.data ?? []) as AdminRequest[]).slice(0, 6);
  const expiringDocuments = (expiringDocumentsListRes.data ?? []) as AdminExpiringDocument[];

  return {
    stats,
    activeRequests,
    expiringDocuments,
  };
}
