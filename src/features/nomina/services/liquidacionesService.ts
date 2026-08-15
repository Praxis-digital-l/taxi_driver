import { supabase } from "@/integrations/supabase/client";
import { type ResultadoNomina, type DetalleDescuento } from "@/lib/nomina";
import type { Json } from "@/integrations/supabase/types";

export type LiquidacionRecord = {
  id: string;
  profile_id: string;
  worker_id: string;
  nombre: string;
  email: string | null;
  rut: string | null;
  total_facturado: number;
  descuentos_primarios: DetalleDescuento[];
  subtotal: number;
  descuentos_secundarios: DetalleDescuento[];
  total_descuentos: number;
  total_a_pagar: number;
  mes: string;
  fecha: string;
  file_url: string | null;
  enviado_por: string | null;
  created_at: string;
};

const LIQUIDACIONES_BUCKET = "Liquidaciones";
const LIQUIDACION_COLUMNS = "id, profile_id, worker_id, nombre, email, rut, total_facturado, descuentos_primarios, subtotal, descuentos_secundarios, total_descuentos, total_a_pagar, mes, fecha, file_url, enviado_por, created_at";

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function parseDescuentos(value: Json | null | undefined): DetalleDescuento[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      concepto: String(obj.concepto ?? ""),
      monto: Number(obj.monto ?? 0),
    };
  });
}

function toRecord(row: Record<string, unknown>): LiquidacionRecord {
  return {
    id: String(row.id),
    profile_id: String(row.profile_id),
    worker_id: String(row.worker_id),
    nombre: String(row.nombre),
    email: row.email ? String(row.email) : null,
    rut: row.rut ? String(row.rut) : null,
    total_facturado: Number(row.total_facturado),
    descuentos_primarios: parseDescuentos(row.descuentos_primarios as Json),
    subtotal: Number(row.subtotal),
    descuentos_secundarios: parseDescuentos(row.descuentos_secundarios as Json),
    total_descuentos: Number(row.total_descuentos),
    total_a_pagar: Number(row.total_a_pagar),
    mes: String(row.mes),
    fecha: String(row.fecha),
    file_url: row.file_url ? String(row.file_url) : null,
    enviado_por: row.enviado_por ? String(row.enviado_por) : null,
    created_at: String(row.created_at),
  };
}

async function resolveProfileId(trabajadorId: string): Promise<string> {
  const { data: byWorkerId } = await supabase
    .from("profiles")
    .select("id")
    .eq("worker_id", trabajadorId)
    .maybeSingle();

  let profile = byWorkerId as { id: string } | null;

  if (!profile) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trabajadorId)) {
      const { data: byId } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", trabajadorId)
        .maybeSingle();
      profile = byId as { id: string } | null;
    }
  }

  if (!profile?.id) {
    throw new Error(`No se encontró un conductor con ID de trabajador ${trabajadorId}`);
  }
  return profile.id;
}

export async function enviarLiquidacion(
  resultado: ResultadoNomina,
  mes: string,
  fecha: string,
  pdfBlob: Blob | null,
) {
  const profileId = await resolveProfileId(resultado.trabajadorId);

  let fileUrl: string | null = null;
  if (pdfBlob) {
    const fileKey = `${profileId}/liquidacion-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(LIQUIDACIONES_BUCKET)
      .upload(fileKey, pdfBlob, { upsert: true, contentType: "application/pdf" });

    if (uploadError) {
      throw new Error(`No se pudo subir el PDF: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(LIQUIDACIONES_BUCKET).getPublicUrl(fileKey);
    fileUrl = publicUrlData?.publicUrl ?? null;
  }

  const { data, error } = await supabase
    .from("liquidaciones")
    .insert({
      profile_id: profileId,
      worker_id: resultado.trabajadorId,
      nombre: resultado.nombre,
      email: resultado.email,
      rut: resultado.rut,
      total_facturado: resultado.totalFacturado,
      descuentos_primarios: resultado.descuentosPrimarios as unknown as Json,
      subtotal: resultado.subtotal,
      descuentos_secundarios: resultado.descuentosSecundarios as unknown as Json,
      total_descuentos: resultado.totalDescuentos,
      total_a_pagar: resultado.totalAPagar,
      mes,
      fecha,
      file_url: fileUrl,
    })
    .select(LIQUIDACION_COLUMNS)
    .single();

  assertNoError(error);
  return toRecord(data as Record<string, unknown>);
}

export async function fetchLiquidacionesByProfile(profileId: string) {
  const { data, error } = await supabase
    .from("liquidaciones")
    .select(LIQUIDACION_COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(toRecord);
}
