import { supabase } from "@/integrations/supabase/client";
import { fileToCompressedDataUrl } from "@/features/conductor/services/conductorProfileService";

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
  photo_url: string | null;
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
  fullName?: string;
  email?: string;
  phone?: string;
  rut?: string;
  worker_id?: string;
  estado_conductor?: string;
  score?: number | null;
  photo_url?: string | null;
  password?: string;
  existing_user_id?: string;
};

export async function updateConductorScore(id: string, score: number | null) {
  const { error } = await supabase.from("profiles").update({ score }).eq("id", id);
  assertNoError(error);
}

export async function uploadConductorAvatarByAdmin(profileId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `conductores/${profileId}/avatar-${Date.now()}.${ext}`;

  let finalUrl: string;

  const { error: uploadError } = await supabase.storage
    .from("Avatares")
    .upload(fileKey, file, { upsert: true });

  if (uploadError) {
    finalUrl = await fileToCompressedDataUrl(file);
  } else {
    const { data } = supabase.storage.from("Avatares").getPublicUrl(fileKey);
    finalUrl = data.publicUrl;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ photo_url: finalUrl })
    .eq("id", profileId);
  assertNoError(updateError);

  return finalUrl;
}

const CONDUCTOR_COLUMNS = "id, user_id, nombres, apellido_paterno, apellido_materno, full_name, email, phone, rut, worker_id, score, estado_conductor, photo_url, role, created_at, updated_at";

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
    photo_url: row.photo_url ? String(row.photo_url) : null,
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
  password?: string;
}) {
  const nombresClean = (payload.nombres ?? "").trim();
  const paternoClean = (payload.apellidoPaterno ?? "").trim();
  const maternoClean = (payload.apellidoMaterno ?? "").trim();
  const emailClean = (payload.email ?? "").trim().toLowerCase();
  const phoneClean = (payload.phone ?? "").trim();
  const rutClean = (payload.rut ?? "").trim();
  const passwordClean = (payload.password ?? "").trim();
  const fullName = [nombresClean, paternoClean, maternoClean].filter(Boolean).join(" ");

  type ExistingProfileRow = {
    id: string;
    user_id: string | null;
    email: string | null;
    worker_id: string | null;
  };

  let existingProfile: ExistingProfileRow | null = null;

  if (rutClean) {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, email, worker_id")
      .eq("rut", rutClean)
      .maybeSingle();
    if (data?.id) existingProfile = data as ExistingProfileRow;
  }

  if (!existingProfile && emailClean) {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, email, worker_id")
      .ilike("email", emailClean)
      .maybeSingle();
    if (data?.id) existingProfile = data as ExistingProfileRow;
  }

  if (!existingProfile && phoneClean) {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, email, worker_id")
      .eq("phone", phoneClean)
      .maybeSingle();
    if (data?.id) existingProfile = data as ExistingProfileRow;
  }

  // Si se proporcionó contraseña en el Excel/CSV, crear o actualizar la cuenta de inicio de sesión en Supabase Auth
  if (passwordClean) {
    const effectiveEmail = emailClean || (existingProfile?.email ?? "").trim().toLowerCase();
    if (!effectiveEmail) {
      throw new Error(
        "Para registrar contraseña y permitir el inicio de sesión, debes incluir el correo electrónico del conductor."
      );
    }

    const workerId = existingProfile?.worker_id || (await generateWorkerId());

    const { data: fnData, error: fnError } = await supabase.functions.invoke("create-conductor", {
      body: {
        email: effectiveEmail,
        password: passwordClean,
        full_name: fullName,
        nombres: nombresClean,
        apellido_paterno: paternoClean,
        apellido_materno: maternoClean,
        phone: phoneClean,
        rut: rutClean,
        worker_id: workerId,
        existing_user_id: existingProfile?.user_id || undefined,
      },
    });

    if (fnError) {
      let msg = fnError.message;
      try {
        const parsed = JSON.parse(fnError.message);
        if (parsed.error) msg = parsed.error;
      } catch {
        // Texto directo
      }
      throw new Error(msg);
    }

    const fnResult = fnData as { user_id?: string; profile_id?: string; error?: string } | null;
    if (fnResult?.error) {
      throw new Error(fnResult.error);
    }

    let finalProfileId = existingProfile?.id || fnResult?.profile_id || null;

    if (!finalProfileId && fnResult?.user_id) {
      const { data: profByUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", fnResult.user_id)
        .maybeSingle();
      if (profByUser?.id) finalProfileId = profByUser.id;
    }

    if (finalProfileId) {
      await supabase
        .from("profiles")
        .update({
          ...(fnResult?.user_id ? { user_id: fnResult.user_id } : {}),
          ...(nombresClean ? { nombres: nombresClean } : {}),
          ...(paternoClean ? { apellido_paterno: paternoClean } : {}),
          ...(maternoClean ? { apellido_materno: maternoClean } : {}),
          ...(fullName ? { full_name: fullName } : {}),
          ...(effectiveEmail ? { email: effectiveEmail } : {}),
          ...(phoneClean ? { phone: phoneClean } : {}),
          ...(rutClean ? { rut: rutClean } : {}),
          ...(workerId ? { worker_id: workerId } : {}),
        })
        .eq("id", finalProfileId);
      return finalProfileId;
    }

    throw new Error("No se pudo obtener el perfil del conductor creado con contraseña.");
  }

  // Si NO se proporcionó contraseña pero el conductor ya existe en profiles, actualizamos sus campos no vacíos
  if (existingProfile?.id) {
    await supabase
      .from("profiles")
      .update({
        ...(nombresClean ? { nombres: nombresClean } : {}),
        ...(paternoClean ? { apellido_paterno: paternoClean } : {}),
        ...(maternoClean ? { apellido_materno: maternoClean } : {}),
        ...(fullName ? { full_name: fullName } : {}),
        ...(emailClean ? { email: emailClean } : {}),
        ...(phoneClean ? { phone: phoneClean } : {}),
        ...(rutClean ? { rut: rutClean } : {}),
      })
      .eq("id", existingProfile.id);
    return existingProfile.id;
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
  const updateData: Record<string, string | number | null> = {};

  if (payload.nombres !== undefined) updateData.nombres = payload.nombres.trim();
  if (payload.apellidoPaterno !== undefined) updateData.apellido_paterno = payload.apellidoPaterno.trim();
  if (payload.apellidoMaterno !== undefined) updateData.apellido_materno = payload.apellidoMaterno.trim();

  if (
    payload.fullName !== undefined ||
    payload.nombres !== undefined ||
    payload.apellidoPaterno !== undefined ||
    payload.apellidoMaterno !== undefined
  ) {
    const joinedName = [
      (payload.nombres ?? "").trim(),
      (payload.apellidoPaterno ?? "").trim(),
      (payload.apellidoMaterno ?? "").trim(),
    ]
      .filter(Boolean)
      .join(" ");
    updateData.full_name = (payload.fullName ?? "").trim() || joinedName;
  }

  if (payload.email !== undefined) updateData.email = payload.email.trim().toLowerCase();
  if (payload.phone !== undefined) updateData.phone = payload.phone.trim() || null;
  if (payload.rut !== undefined) updateData.rut = payload.rut.trim() || null;
  if (payload.worker_id !== undefined) updateData.worker_id = payload.worker_id.trim() || null;
  if (payload.estado_conductor !== undefined) updateData.estado_conductor = payload.estado_conductor;
  if (payload.score !== undefined) updateData.score = payload.score;
  if (payload.photo_url !== undefined) updateData.photo_url = payload.photo_url;

  const passwordClean = (payload.password ?? "").trim();
  if (passwordClean) {
    if (passwordClean.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }
    const effectiveEmail = (payload.email ?? "").trim().toLowerCase();
    if (!effectiveEmail) {
      throw new Error("Debes ingresar un correo electrónico válido para asignarle una contraseña al conductor.");
    }

    const { data: fnData, error: fnError } = await supabase.functions.invoke("create-conductor", {
      body: {
        email: effectiveEmail,
        password: passwordClean,
        full_name: String(updateData.full_name ?? ""),
        nombres: String(updateData.nombres ?? ""),
        apellido_paterno: String(updateData.apellido_paterno ?? ""),
        apellido_materno: String(updateData.apellido_materno ?? ""),
        phone: updateData.phone ? String(updateData.phone) : "",
        rut: updateData.rut ? String(updateData.rut) : "",
        worker_id: updateData.worker_id ? String(updateData.worker_id) : undefined,
        existing_user_id: payload.existing_user_id || undefined,
      },
    });

    if (fnError) {
      let msg = fnError.message;
      try {
        const parsed = JSON.parse(fnError.message);
        if (parsed.error) msg = parsed.error;
      } catch {
        // Texto directo
      }
      throw new Error(msg);
    }

    const fnResult = fnData as { user_id?: string; error?: string } | null;
    if (fnResult?.error) {
      throw new Error(fnResult.error);
    }
    if (fnResult?.user_id) {
      updateData.user_id = fnResult.user_id;
    }
  }

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
