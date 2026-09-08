import { supabase } from "@/integrations/supabase/client";

export type ConductorDelMes = {
  id: string;
  month: number;
  year: number;
  conductor: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    worker_id?: string | null;
  } | null;
};

export type ConductorCandidate = {
  id: string;
  full_name: string | null;
  worker_id: string | null;
  photo_url: string | null;
};

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchConductorDelMes(month?: number, year?: number): Promise<ConductorDelMes | null> {
  // 1. Intentar con la función SECURITY DEFINER (no depende del RLS de profiles,
  //    por lo que el conductor también puede ver el reconocimiento)
  const { data, error } = await supabase.rpc<
    "get_conductor_del_mes",
    { p_month: number | null; p_year: number | null },
    ConductorDelMes | null
  >("get_conductor_del_mes", { p_month: month ?? null, p_year: year ?? null });

  if (!error && data && typeof data === "object") {
    return data;
  }

  // 2. Fallback: consulta directa si la función aún no existe en la base de datos
  if (month && year) {
    const { data: direct, error: directError } = await supabase
      .from("conductor_del_mes")
      .select("id, month, year, conductor:profiles!conductor_del_mes_conductor_id_fkey(id, full_name, photo_url, worker_id)")
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (!directError && direct && direct.conductor) {
      return direct as unknown as ConductorDelMes;
    }
  }

  const { data: latest, error: latestError } = await supabase
    .from("conductor_del_mes")
    .select("id, month, year, conductor:profiles!conductor_del_mes_conductor_id_fkey(id, full_name, photo_url, worker_id)")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestError && latest && latest.conductor) {
    return latest as unknown as ConductorDelMes;
  }

  return null;
}

export async function fetchConductorCandidates(): Promise<ConductorCandidate[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, worker_id, photo_url, estado_conductor")
    .eq("role", "conductor")
    .order("full_name", { ascending: true });

  assertNoError(error);
  return ((data ?? []) as Array<ConductorCandidate & { estado_conductor: string | null }>)
    .filter((c) => c.estado_conductor !== "desactivado")
    .map(({ estado_conductor: _estado, ...candidate }) => candidate);
}

export async function setConductorDelMes(
  conductorId: string,
  month: number,
  year: number,
  selectedBy: string,
): Promise<void> {
  const existing = await supabase
    .from("conductor_del_mes")
    .select("id")
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  assertNoError(existing.error);

  if (existing.data?.id) {
    const { error } = await supabase
      .from("conductor_del_mes")
      .update({ conductor_id: conductorId, selected_by: selectedBy })
      .eq("id", existing.data.id);
    assertNoError(error);
    return;
  }

  const { error } = await supabase
    .from("conductor_del_mes")
    .insert({ conductor_id: conductorId, month, year, selected_by: selectedBy });
  assertNoError(error);
}