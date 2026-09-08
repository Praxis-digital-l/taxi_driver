import { supabase } from "@/integrations/supabase/client";

export type ConductorVacationStatus =
  | "pendiente"
  | "programada"
  | "en_curso"
  | "finalizada"
  | "rechazado"
  | "cancelada";

export interface ConductorVacation {
  id: string;
  profile_id: string;
  vehicle_id: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  surcharge_percentage: number;
  rent_postponed: boolean;
  status: ConductorVacationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: {
    id: string;
    license_plate: string;
    make?: string;
    model?: string;
  } | null;
}

export async function fetchConductorVacations(profileId: string): Promise<ConductorVacation[]> {
  const today = new Date().toISOString().slice(0, 10);

  const resolveStatus = (
    currentStatus: string,
    startDate: string,
    endDate: string,
    notes?: string | null
  ): ConductorVacationStatus => {
    const s = (currentStatus || "").toLowerCase();
    const n = (notes || "").toLowerCase();

    if (s === "cancelada" || s === "cancelado") return "cancelada";
    if (s === "rechazada" || s === "rechazado" || n.includes("rechazad")) return "rechazado";
    if (s === "pendiente" || n.includes("[status:pendiente]") || n.includes("[estado_solicitud:pendiente]")) {
      return "pendiente";
    }

    // Aprobada / Programada: verificar según fechas
    if (startDate <= today && endDate >= today) {
      return "en_curso";
    }
    if (endDate < today) {
      return "finalizada";
    }
    return "programada";
  };

  try {
    // 1. Obtener solicitudes desde requests para vincular estado de aprobación admin
    const { data: reqs } = await supabase
      .from("requests")
      .select("id, profile_id, vehicle_id, details, status, created_at, updated_at, vehicles(id, license_plate)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    const vacationRequests = (reqs || []).filter(
      (r) => r.details?.includes("[VACACIONES") || r.details?.includes("[SOLICITUD DE VACACIONES")
    );

    // 2. Obtener registros de conductor_vacations
    const { data: vacData, error: vacError } = await supabase
      .from("conductor_vacations")
      .select("*, vehicles(id, license_plate, make, model)")
      .eq("profile_id", profileId)
      .order("start_date", { ascending: false });

    const results: ConductorVacation[] = [];

    if (!vacError && vacData && vacData.length > 0) {
      for (const v of vacData as any[]) {
        // Buscar si existe un request asociado con el mismo rango de fechas
        const linkedReq = vacationRequests.find(
          (r) =>
            r.details?.includes(v.start_date) &&
            r.details?.includes(v.end_date)
        );

        let finalStatus = v.status;
        let finalNotes = v.notes || "";

        if (linkedReq) {
          if (linkedReq.status === "rechazado") {
            finalStatus = "rechazado";
            if (linkedReq.details && linkedReq.details.includes("MOTIVO DEL RECHAZO")) {
              finalNotes = linkedReq.details;
            }
          } else if (linkedReq.status === "pendiente") {
            finalStatus = "pendiente";
          } else if (linkedReq.status === "aprobado" && finalStatus === "pendiente") {
            finalStatus = "programada";
          }
        }

        results.push({
          ...v,
          status: resolveStatus(finalStatus, v.start_date, v.end_date, finalNotes),
          notes: finalNotes,
        });
      }
    }

    // Si existen solicitudes en 'requests' que no están en conductor_vacations, incorporarlas
    for (const r of vacationRequests) {
      const matchDates = r.details?.match(
        /Salida:\s*(\d{4}-\d{2}-\d{2})\s*·\s*Retorno:\s*(\d{4}-\d{2}-\d{2})\s*\((\d+)\s*días\)/
      );
      const startDate = matchDates ? matchDates[1] : r.created_at?.slice(0, 10) || today;
      const endDate = matchDates ? matchDates[2] : r.created_at?.slice(0, 10) || today;
      const daysCount = matchDates ? parseInt(matchDates[3], 10) : 1;

      const alreadyExists = results.some(
        (v) => v.start_date === startDate && v.end_date === endDate
      );

      if (!alreadyExists) {
        results.push({
          id: r.id,
          profile_id: r.profile_id,
          vehicle_id: r.vehicle_id,
          start_date: startDate,
          end_date: endDate,
          days_count: daysCount,
          surcharge_percentage: 10,
          rent_postponed: true,
          status: resolveStatus(r.status || "pendiente", startDate, endDate, r.details),
          notes: r.details,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || r.created_at || new Date().toISOString(),
          vehicles: r.vehicles as any,
        });
      }
    }

    // Ordenar de más reciente a más antigua
    results.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    return results;
  } catch (error) {
    console.warn("Excepción al consultar vacaciones:", error);
    return [];
  }
}

export async function registerConductorVacation(payload: {
  profileId: string;
  vehicleId?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  notes?: string;
}): Promise<ConductorVacation> {
  const today = new Date().toISOString().slice(0, 10);

  // Regla 1: Validar fechas pasadas
  if (payload.startDate < today) {
    throw new Error("No puedes solicitar vacaciones con fechas anteriores al día de hoy.");
  }
  if (payload.endDate < payload.startDate) {
    throw new Error("La fecha de retorno debe ser posterior o igual a la fecha de salida.");
  }

  // Regla 2: Comprobar si ya tiene una solicitud pendiente (solo se permite una solicitud a la vez)
  const existingVacations = await fetchConductorVacations(payload.profileId);
  const pending = existingVacations.find((v) => v.status === "pendiente");
  if (pending) {
    throw new Error(
      `Ya tienes una solicitud de vacaciones en revisión por la administración (del ${pending.start_date} al ${pending.end_date}). Debes esperar a que sea aprobada o rechazada.`
    );
  }

  // Regla 3: Validar que no se superponga con vacaciones ya existentes
  const overlap = existingVacations.find(
    (v) =>
      v.status !== "cancelada" &&
      v.status !== "rechazado" &&
      payload.startDate <= v.end_date &&
      payload.endDate >= v.start_date
  );
  if (overlap) {
    throw new Error(
      `Las fechas seleccionadas coinciden con otro período de vacaciones registrado (del ${overlap.start_date} al ${overlap.end_date}).`
    );
  }

  // Obtener tipo de solicitud "Vacaciones"
  const { data: requestTypes } = await supabase.from("request_types").select("id, name");
  let reqTypeId = requestTypes?.find((rt: any) =>
    rt.name?.toLowerCase().includes("vacacion") || rt.name?.toLowerCase().includes("arriendo")
  )?.id;

  if (!reqTypeId && requestTypes && requestTypes.length > 0) {
    reqTypeId = requestTypes[0].id;
  }

  const detailsText = `[SOLICITUD DE VACACIONES Y POSTERGACIÓN DE ARRIENDO] Salida: ${payload.startDate} · Retorno: ${payload.endDate} (${payload.daysCount} días). Se solicita postergación de pago de arriendo con recargo del 10% al retorno. Estado: Pendiente de aprobación por administración.`;

  // 1. Guardar en 'requests' como PENDIENTE para que le llegue directamente al Admin
  let createdRequestId: string | null = null;
  if (reqTypeId) {
    const { data: newReq, error: reqError } = await supabase
      .from("requests")
      .insert({
        profile_id: payload.profileId,
        request_type_id: reqTypeId,
        vehicle_id: payload.vehicleId || null,
        details: detailsText,
        status: "pendiente",
      })
      .select("id")
      .single();

    if (!reqError && newReq) {
      createdRequestId = newReq.id;
    }
  }

  // 2. Guardar en 'conductor_vacations' en estado PENDIENTE
  const newVacationData = {
    profile_id: payload.profileId,
    vehicle_id: payload.vehicleId || null,
    start_date: payload.startDate,
    end_date: payload.endDate,
    days_count: payload.daysCount,
    surcharge_percentage: 10,
    rent_postponed: true,
    status: "pendiente",
    notes: detailsText,
  };

  let savedRecord: ConductorVacation | null = null;

  try {
    const { data, error } = await supabase
      .from("conductor_vacations")
      .insert(newVacationData)
      .select("*, vehicles(id, license_plate, make, model)")
      .single();

    if (!error && data) {
      savedRecord = data as unknown as ConductorVacation;
    } else {
      // Si la base de datos tiene restricción de CHECK que solo admita 'programada'
      if (error?.message?.includes("conductor_vacations_status_check")) {
        const fallbackData = {
          ...newVacationData,
          status: "programada",
          notes: `[STATUS:pendiente] ${detailsText}`,
        };
        const { data: fbData } = await supabase
          .from("conductor_vacations")
          .insert(fallbackData)
          .select("*, vehicles(id, license_plate, make, model)")
          .single();
        if (fbData) {
          savedRecord = { ...(fbData as any), status: "pendiente" };
        }
      }
    }
  } catch (err) {
    console.warn("Excepción al guardar en conductor_vacations:", err);
  }

  if (savedRecord) {
    return { ...savedRecord, status: "pendiente" };
  }

  return {
    id: createdRequestId || `vac-${Date.now()}`,
    ...newVacationData,
    status: "pendiente",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function cancelConductorVacation(vacationId: string): Promise<void> {
  // Cancelar en conductor_vacations
  try {
    await supabase
      .from("conductor_vacations")
      .update({ status: "cancelada", updated_at: new Date().toISOString() })
      .eq("id", vacationId);
  } catch (error) {
    console.warn("Aviso al cancelar en conductor_vacations:", error);
  }

  // Cancelar en requests
  try {
    await supabase
      .from("requests")
      .update({ status: "cancelado" })
      .eq("id", vacationId);
  } catch (error) {
    console.warn("Aviso al cancelar en requests:", error);
  }
}


