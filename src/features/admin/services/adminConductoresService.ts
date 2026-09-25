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
  worker_id?: string;
  score: number | null;
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

export async function updateConductorScore(id: string, score: number | null) {
  const { error } = await supabase.from("profiles").update({ score }).eq("id", id);
  assertNoError(error);
}

const CONDUCTOR_COLUMNS = "id, user_id, nombres, apellido_paterno, apellido_materno, full_name, email, phone, rut, worker_id, score, estado_conductor, role, created_at, updated_at";

function assertNoError(error: { message: string; code?: string; details?: string | null } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function normalizeConductorRow(row: Record<string, unknown>): ConductorRecord {
  return {
    id: String(row.id ?? ""),
    user_id: row.user_id ? String(row.user_id) : "",
    nombres: String(row.nombres ?? ""),
    apellido_paterno: String(row.apellido_paterno ?? ""),
    apellido_materno: String(row.apellido_materno ?? ""),
    full_name: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    phone: row.phone ? String(row.phone) : null,
    rut: String(row.rut ?? ""),
    worker_id: row.worker_id ? String(row.worker_id) : undefined,
    score: row.score != null ? Number(row.score) : null,
    estado_conductor: String(row.estado_conductor ?? "nuevo"),
    role: String(row.role ?? "conductor"),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function fetchAdminConductores() {
  const { data, error } = await supabase
    .from("profiles")
    .select(CONDUCTOR_COLUMNS)
    .eq("role", "conductor")
    .order("full_name", { ascending: true });

  assertNoError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeConductorRow);
}

export async function fetchConductorDetail(id: string) {
  const { data: conductor, error: conductorError } = await supabase
    .from("profiles")
    .select(CONDUCTOR_COLUMNS)
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
    ...normalizeConductorRow(conductor as Record<string, unknown>),
    vehicles: (vehicles ?? []) as ConductorVehicleRecord[],
  } as ConductorDetailRecord;
}

async function generateWorkerId(): Promise<string> {
  const { data: last } = await supabase
    .from("profiles")
    .select("worker_id")
    .not("worker_id", "is", null)
    .order("worker_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.worker_id) {
    const match = last.worker_id.match(/TR-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `TR-${String(nextNumber).padStart(6, "0")}`;
}

export async function createConductor(payload: CreateConductorPayload) {
  const rutTrim = payload.rut.trim();
  const phoneTrim = payload.phone.trim();

  if (rutTrim) {
    const { data: existingRut } = await supabase
      .from("profiles")
      .select("id")
      .eq("rut", rutTrim)
      .maybeSingle();
    if (existingRut) throw new Error("Ya existe un conductor con este RUT");
  }

  if (phoneTrim) {
    const { data: existingPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phoneTrim)
      .maybeSingle();
    if (existingPhone) throw new Error("Ya existe un conductor con este teléfono");
  }

  const workerId = await generateWorkerId();

  const fullName = `${payload.nombres.trim()} ${payload.apellidoPaterno.trim()} ${payload.apellidoMaterno.trim()}`.trim();

  const { data: fnData, error: fnError } = await supabase.functions.invoke("create-conductor", {
    body: {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      full_name: fullName,
      nombres: payload.nombres.trim(),
      apellido_paterno: payload.apellidoPaterno.trim(),
      apellido_materno: payload.apellidoMaterno.trim(),
      phone: phoneTrim,
      rut: rutTrim,
      worker_id: workerId,
    },
  });

  if (fnError) {
    let msg = fnError.message;
    try {
      const parsed = JSON.parse(fnError.message);
      if (parsed.error) msg = parsed.error;
    } catch {
      // El mensaje no era JSON, se usa el texto original
    }
    throw new Error(msg);
  }

  // Fallback: si la edge function no pudo escribir el worker_id, asignarlo directamente
  const createdUserId = (fnData as { user_id?: string } | null)?.user_id;
  if (createdUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, worker_id")
      .eq("user_id", createdUserId)
      .maybeSingle();

    if (profile && !profile.worker_id) {
      await supabase.from("profiles").update({ worker_id: workerId }).eq("id", profile.id);
    }
  }
}

export async function createConductorProfile(payload: {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email?: string;
  phone?: string;
  rut?: string;
}) {
  const nombresClean = (payload.nombres ?? "").trim();
  const paternoClean = (payload.apellidoPaterno ?? "").trim();
  const maternoClean = (payload.apellidoMaterno ?? "").trim();
  const emailClean = (payload.email ?? "").trim().toLowerCase();
  const phoneClean = (payload.phone ?? "").trim();
  const rutClean = (payload.rut ?? "").trim();
  const fullName = [nombresClean, paternoClean, maternoClean].filter(Boolean).join(" ");

  // Si ya existe un conductor con el mismo RUT (cuando no está vacío), actualizamos sus datos no vacíos y retornamos su ID
  if (rutClean) {
    const { data: existingByRut } = await supabase
      .from("profiles")
      .select("id")
      .eq("rut", rutClean)
      .maybeSingle();

    if (existingByRut?.id) {
      await supabase
        .from("profiles")
        .update({
          ...(nombresClean ? { nombres: nombresClean } : {}),
          ...(paternoClean ? { apellido_paterno: paternoClean } : {}),
          ...(maternoClean ? { apellido_materno: maternoClean } : {}),
          ...(fullName ? { full_name: fullName } : {}),
          ...(emailClean ? { email: emailClean } : {}),
          ...(phoneClean ? { phone: phoneClean } : {}),
        })
        .eq("id", existingByRut.id);
      return existingByRut.id;
    }
  }

  // Si ya existe un conductor con el mismo teléfono (cuando no está vacío), actualizamos sus datos no vacíos y retornamos su ID
  if (phoneClean) {
    const { data: existingByPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phoneClean)
      .maybeSingle();

    if (existingByPhone?.id) {
      await supabase
        .from("profiles")
        .update({
          ...(nombresClean ? { nombres: nombresClean } : {}),
          ...(paternoClean ? { apellido_paterno: paternoClean } : {}),
          ...(maternoClean ? { apellido_materno: maternoClean } : {}),
          ...(fullName ? { full_name: fullName } : {}),
          ...(emailClean ? { email: emailClean } : {}),
          ...(rutClean ? { rut: rutClean } : {}),
        })
        .eq("id", existingByPhone.id);
      return existingByPhone.id;
    }
  }

  const workerId = await generateWorkerId();

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      nombres: nombresClean,
      apellido_paterno: paternoClean,
      apellido_materno: maternoClean,
      full_name: fullName,
      email: emailClean,
      phone: phoneClean || null,
      rut: rutClean || null,
      worker_id: workerId,
      role: "conductor",
    })
    .select("id")
    .single();
  assertNoError(error);

  const createdId = Array.isArray(data) ? (data[0] as { id: string } | undefined)?.id : (data as { id: string } | undefined)?.id;
  if (!createdId) throw new Error("No se pudo obtener el id del conductor creado");
  return createdId;
}

export async function updateConductor(id: string, payload: UpdateConductorPayload) {
  const updateData: Record<string, string | null> = {};

  if (payload.nombres !== undefined) updateData.nombres = payload.nombres.trim();
  if (payload.apellidoPaterno !== undefined) updateData.apellido_paterno = payload.apellidoPaterno.trim();
  if (payload.apellidoMaterno !== undefined) updateData.apellido_materno = payload.apellidoMaterno.trim();
  if (payload.email !== undefined) updateData.email = payload.email.trim().toLowerCase();
  if (payload.phone !== undefined) updateData.phone = payload.phone.trim() || null;
  if (payload.rut !== undefined) updateData.rut = payload.rut.trim() || null;
  if (payload.estado_conductor !== undefined) updateData.estado_conductor = payload.estado_conductor;

  const { error } = await supabase.from("profiles").update(updateData).eq("id", id);
  assertNoError(error);
}

export async function deleteConductor(profileId: string, userId: string) {
  await Promise.allSettled([
    supabase.from("vehicle_assignments").delete().eq("profile_id", profileId),
    supabase.from("documents").delete().eq("profile_id", profileId),
    supabase.from("requests").delete().eq("profile_id", profileId),
    supabase.from("mileage_records").delete().eq("profile_id", profileId),
    supabase.from("messages").delete().or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`),
    supabase.from("admin_notes").delete().eq("admin_id", profileId),
  ]);

  let deleted = false;

  if (userId && typeof supabase.functions?.invoke === "function") {
    try {
      const { error } = await supabase.functions.invoke("delete-conductor", {
        body: { user_id: userId },
      });
      if (!error) deleted = true;
    } catch {
      // Edge Function no disponible
    }
  }

  if (!deleted) {
    const { error, count } = await supabase
      .from("profiles")
      .delete({ count: "exact" })
      .eq("id", profileId);

    if (error) throw new Error(error.message);
    if (count === 0) throw new Error("No tienes permisos para eliminar conductores. El admin necesita una política RLS de DELETE en la tabla profiles.");
  }
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
