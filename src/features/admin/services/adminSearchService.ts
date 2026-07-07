import { supabase } from "@/integrations/supabase/client";

export type VehicleSearchOption = {
  id: string;
  license_plate: string;
  make: string | null;
  model: string | null;
  status: string | null;
};

export type AssignedConductor = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

export type AdminSearchDocument = {
  id: string;
  status: string;
  description: string | null;
  file_url: string;
  file_key: string;
  expiration_date: string | null;
  created_at: string;
  document_types?: { name: string | null } | null;
  profiles?: { full_name: string | null } | null;
};

export type AdminSearchRequest = {
  id: string;
  status: string;
  details: string | null;
  amount: number | null;
  created_at: string;
  request_types?: { name: string | null } | null;
  profiles?: { full_name: string | null } | null;
};

export type AdminSearchMileage = {
  id: string;
  kilometers: number;
  recorded_date: string;
  notes: string | null;
  profiles?: { full_name: string | null } | null;
};

export type AdminSearchNote = {
  id: string;
  note_text: string;
  created_at: string;
};

export type AdminSearchMessage = {
  id: string;
  status: string;
  content: string;
  created_at: string;
  sender?: { full_name: string | null } | null;
};

export type AdminSearchVehicle = {
  id: string;
  license_plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  status: string | null;
};

export type AdminVehicleSearchPayload = {
  vehicle: AdminSearchVehicle;
  conductor: AssignedConductor | null;
  documents: AdminSearchDocument[];
  requests: AdminSearchRequest[];
  mileage: AdminSearchMileage[];
  notes: AdminSearchNote[];
  messages: AdminSearchMessage[];
};

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchVehiclePlateSuggestions(): Promise<VehicleSearchOption[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, license_plate, make, model, status")
    .order("license_plate", { ascending: true });

  assertNoError(error);
  return (data ?? []) as VehicleSearchOption[];
}

export async function fetchAdminVehicleSearchByPlate(plate: string): Promise<AdminVehicleSearchPayload | null> {
  const normalizedPlate = plate.trim().toUpperCase();
  if (!normalizedPlate) {
    return null;
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, license_plate, make, model, year, color, status")
    .eq("license_plate", normalizedPlate)
    .maybeSingle();

  assertNoError(vehicleError);
  if (!vehicle) {
    return null;
  }

  const [assignmentRes, documentsRes, requestsRes, mileageRes, notesRes] = await Promise.all([
    supabase
      .from("vehicle_assignments")
      .select("profile_id, profiles(id, full_name, email, phone)")
      .eq("vehicle_id", vehicle.id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, status, description, file_url, file_key, expiration_date, created_at, document_types(name), profiles(full_name)")
      .eq("vehicle_id", vehicle.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id, status, details, amount, created_at, request_types(name), profiles(full_name)")
      .eq("vehicle_id", vehicle.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("mileage_records")
      .select("id, kilometers, recorded_date, notes, profiles(full_name)")
      .eq("vehicle_id", vehicle.id)
      .order("recorded_date", { ascending: false })
      .limit(20),
    supabase
      .from("admin_notes")
      .select("id, note_text, created_at")
      .eq("vehicle_id", vehicle.id)
      .order("created_at", { ascending: false }),
  ]);

  assertNoError(assignmentRes.error);
  assertNoError(documentsRes.error);
  assertNoError(requestsRes.error);
  assertNoError(mileageRes.error);
  assertNoError(notesRes.error);

  const assignments = assignmentRes.data ?? [];
  const conductor = (assignments[0]?.profiles as AssignedConductor | null) ?? null;
  const profileIds = assignments
    .map((assignment: { profile_id?: string | null }) => assignment.profile_id)
    .filter((value): value is string => Boolean(value));

  let messages: AdminSearchMessage[] = [];
  if (profileIds.length > 0) {
    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select("id, status, content, created_at, sender:profiles!messages_sender_id_fkey(full_name)")
      .in("receiver_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(10);

    assertNoError(messagesError);
    messages = (messagesData ?? []) as AdminSearchMessage[];
  }

  return {
    vehicle,
    conductor,
    documents: (documentsRes.data ?? []) as AdminSearchDocument[],
    requests: (requestsRes.data ?? []) as AdminSearchRequest[],
    mileage: (mileageRes.data ?? []) as AdminSearchMileage[],
    notes: (notesRes.data ?? []) as AdminSearchNote[],
    messages,
  };
}

export async function createAdminNote(vehicleId: string, adminId: string, noteText: string) {
  const { error } = await supabase.from("admin_notes").insert({
    vehicle_id: vehicleId,
    admin_id: adminId,
    note_text: noteText,
  });

  assertNoError(error);
}

export async function deleteAdminNote(noteId: string) {
  const { error } = await supabase.from("admin_notes").delete().eq("id", noteId);
  assertNoError(error);
}

export async function fetchVehicleNotes(vehicleId: string): Promise<AdminSearchNote[]> {
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id, note_text, created_at")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as AdminSearchNote[];
}

export async function sendMessageToConductor(params: {
  senderId: string;
  receiverId: string;
  content: string;
  status?: string;
}) {
  const { senderId, receiverId, content, status = "pendiente" } = params;

  const { error } = await supabase.from("messages").insert({
    sender_id: senderId,
    receiver_id: receiverId,
    content: content.trim(),
    status,
  });

  assertNoError(error);
}
