import { supabase } from "@/integrations/supabase/client";

export interface ConductorVacation {
  id: string;
  profile_id: string;
  vehicle_id: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  surcharge_percentage: number;
  rent_postponed: boolean;
  status: "programada" | "en_curso" | "finalizada" | "cancelada";
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

  const normalizeStatus = (
    currentStatus: string,
    startDate: string,
    endDate: string,
  ): "programada" | "en_curso" | "finalizada" | "cancelada" => {
    if (currentStatus === "cancelada" || currentStatus === "cancelado" || currentStatus === "rechazado") {
      return "cancelada";
    }
    if (startDate <= today && endDate >= today) {
      return "en_curso";
    }
    if (endDate < today) {
      return "finalizada";
    }
    return "programada";
  };

  try {
    const { data, error } = await supabase
      .from("conductor_vacations")
      .select("*, vehicles(id, license_plate, make, model)")
      .eq("profile_id", profileId)
      .order("start_date", { ascending: false });

    if (!error && data && data.length > 0) {
      return (data as unknown as ConductorVacation[]).map((v) => ({
        ...v,
        status: normalizeStatus(v.status, v.start_date, v.end_date),
      }));
    }

    // Si la tabla aún no tiene datos o no ha sido creada en Supabase, consultar solicitudes en 'requests'
    const { data: reqs } = await supabase
      .from("requests")
      .select("id, profile_id, vehicle_id, details, status, created_at, updated_at, vehicles(id, license_plate)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (reqs && reqs.length > 0) {
      const vacReqs = reqs.filter((r) => r.details?.includes("[VACACIONES"));
      if (vacReqs.length > 0) {
        return vacReqs.map((r) => {
          const matchDates = r.details?.match(
            /Salida:\s*(\d{4}-\d{2}-\d{2})\s*·\s*Retorno:\s*(\d{4}-\d{2}-\d{2})\s*\((\d+)\s*días\)/,
          );
          const startDate = matchDates ? matchDates[1] : r.created_at?.slice(0, 10) || today;
          const endDate = matchDates ? matchDates[2] : r.created_at?.slice(0, 10) || today;
          const daysCount = matchDates ? parseInt(matchDates[3], 10) : 1;

          return {
            id: r.id,
            profile_id: r.profile_id,
            vehicle_id: r.vehicle_id,
            start_date: startDate,
            end_date: endDate,
            days_count: daysCount,
            surcharge_percentage: 10,
            rent_postponed: true,
            status: normalizeStatus(r.status || "programada", startDate, endDate),
            notes: r.details,
            created_at: r.created_at || new Date().toISOString(),
            updated_at: r.updated_at || r.created_at || new Date().toISOString(),
            vehicles: r.vehicles as any,
          } as ConductorVacation;
        });
      }
    }

    return [];
  } catch (error) {
    console.warn("Excepción al consultar conductor_vacations:", error);
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
  const newVacationData = {
    profile_id: payload.profileId,
    vehicle_id: payload.vehicleId || null,
    start_date: payload.startDate,
    end_date: payload.endDate,
    days_count: payload.daysCount,
    surcharge_percentage: 10,
    rent_postponed: true,
    status: "programada",
    notes: payload.notes || "Postergación de pago de arriendo activada con recargo del 10% al retorno.",
  };

  let savedRecord: ConductorVacation | null = null;

  // 1. Intentar guardar en la tabla conductor_vacations
  try {
    const { data, error } = await supabase
      .from("conductor_vacations")
      .insert(newVacationData)
      .select("*, vehicles(id, license_plate, make, model)")
      .single();

    if (!error && data) {
      savedRecord = data as unknown as ConductorVacation;
    } else {
      console.warn("Aviso al insertar en conductor_vacations:", error?.message);
    }
  } catch (error) {
    console.warn("Excepción al insertar en conductor_vacations:", error);
  }

  // 2. Registrar en la tabla de requests para que el administrador tenga notificación formal
  try {
    const { data: requestTypes } = await supabase.from("request_types").select("id, name");
    let reqTypeId = requestTypes?.find((rt: any) =>
      rt.name?.toLowerCase().includes("vacacion") || rt.name?.toLowerCase().includes("arriendo"),
    )?.id;

    if (!reqTypeId && requestTypes && requestTypes.length > 0) {
      reqTypeId = requestTypes[0].id;
    }

    if (reqTypeId) {
      await supabase.from("requests").insert({
        profile_id: payload.profileId,
        request_type_id: reqTypeId,
        vehicle_id: payload.vehicleId || null,
        details: `[VACACIONES Y POSTERGACIÓN ARRIENDO] Salida: ${payload.startDate} · Retorno: ${payload.endDate} (${payload.daysCount} días). Se activa postergación de pago de arriendo con recargo del 10% al volver.`,
        status: "aprobado",
      });
    }
  } catch (error) {
    console.warn("No se pudo duplicar solicitud en requests:", error);
  }

  if (savedRecord) {
    return savedRecord;
  }

  // Si la tabla aún no se ha ejecutado en Supabase, devolvemos el objeto formateado
  return {
    id: `vac-${Date.now()}`,
    ...newVacationData,
    status: "programada",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function cancelConductorVacation(vacationId: string): Promise<void> {
  try {
    await supabase
      .from("conductor_vacations")
      .update({ status: "cancelada", updated_at: new Date().toISOString() })
      .eq("id", vacationId);
  } catch (error) {
    console.warn("Aviso al cancelar en conductor_vacations:", error);
  }

  try {
    await supabase
      .from("requests")
      .update({ status: "rechazado" })
      .eq("id", vacationId);
  } catch (error) {
    console.warn("Aviso al cancelar en requests:", error);
  }
}

