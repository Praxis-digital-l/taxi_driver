import { supabase } from "@/integrations/supabase/client";
import { sortActiveRequestsByPriority, type AdminRequest } from "@/features/admin/services/adminRequestsService";
import type { AdminExpiringInsurance } from "@/features/admin/services/adminInsuranceService";
import { requiresExpirationDate } from "@/lib/documentRules";

export type AdminDashboardStats = {
  vehicles: number;
  activeVehicles: number;
  conductors: number;
  pendingRequests: number;
  inProcessRequests: number;
  expiringDocs: number;
  totalDocs: number;
  unreadMessages: number;
  expiringInsurances: number;
};

export type AdminExpiringDocument = {
  id: string;
  expiration_date: string;
  document_types?: { name: string | null } | null;
  profiles?: { full_name: string | null } | null;
  vehicles?: { license_plate: string | null } | null;
};

export type AdminDashboardUnreadMessage = {
  id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string | null } | null;
};

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminDashboardData() {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const twoMonths = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [
    vehiclesRes,
    activeVehiclesRes,
    conductorsRes,
    pendingRequestsRes,
    inProcessRequestsRes,
    totalDocumentsRes,
    unreadMessagesRes,
    activeRequestsRes,
    expiringDocumentsListRes,
    unreadMessagesListRes,
    expiringInsurancesRes,
    expiringInsurancesListRes,
  ] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "conductor"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "en_proceso"),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "enviado").is("read_at", null),
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
      .limit(50),
    supabase
      .from("messages")
      .select("id, content, created_at, sender:profiles!messages_sender_id_fkey(full_name)")
      .eq("status", "enviado")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vehicle_insurances")
      .select("id", { count: "exact", head: true })
      .lte("expiration_date", twoMonths)
      .gte("expiration_date", today),
    supabase
      .from("vehicle_insurances")
      .select("id, vehicle_id, insurance_type, custom_insurance_name, amount, expiration_date, payment_status, last_payment_date, created_at, updated_at, vehicles(license_plate)")
      .lte("expiration_date", twoMonths)
      .gte("expiration_date", today)
      .order("expiration_date", { ascending: true })
      .limit(5),
  ]);

  assertNoError(vehiclesRes.error);
  assertNoError(activeVehiclesRes.error);
  assertNoError(conductorsRes.error);
  assertNoError(pendingRequestsRes.error);
  assertNoError(inProcessRequestsRes.error);
  assertNoError(totalDocumentsRes.error);
  assertNoError(unreadMessagesRes.error);
  assertNoError(activeRequestsRes.error);
  assertNoError(expiringDocumentsListRes.error);
  assertNoError(unreadMessagesListRes.error);
  assertNoError(expiringInsurancesRes.error);
  assertNoError(expiringInsurancesListRes.error);

  const allExpiringDocs = ((expiringDocumentsListRes.data ?? []) as AdminExpiringDocument[])
    .filter((doc) => requiresExpirationDate(doc.document_types?.name));

  const stats: AdminDashboardStats = {
    vehicles: vehiclesRes.count || 0,
    activeVehicles: activeVehiclesRes.count || 0,
    conductors: conductorsRes.count || 0,
    pendingRequests: pendingRequestsRes.count || 0,
    inProcessRequests: inProcessRequestsRes.count || 0,
    expiringDocs: allExpiringDocs.length,
    totalDocs: totalDocumentsRes.count || 0,
    unreadMessages: unreadMessagesRes.count || 0,
    expiringInsurances: expiringInsurancesRes.count || 0,
  };

  const activeRequests = sortActiveRequestsByPriority((activeRequestsRes.data ?? []) as AdminRequest[]).slice(0, 6);
  const expiringDocuments = allExpiringDocs.slice(0, 5);
  const unreadMessages = (unreadMessagesListRes.data ?? []) as AdminDashboardUnreadMessage[];
  const expiringInsurances = (expiringInsurancesListRes.data ?? []) as AdminExpiringInsurance[];

  return {
    stats,
    activeRequests,
    expiringDocuments,
    unreadMessages,
    expiringInsurances,
  };
}
