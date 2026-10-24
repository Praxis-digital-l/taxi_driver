import { supabase } from "@/integrations/supabase/client";
import { type ResultadoNomina, type DetalleDescuento } from "@/lib/nomina";
import type { Json } from "@/integrations/supabase/types";
import { PdfLiquidacionService } from "@/features/firmaweb/services/PdfLiquidacionService";

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
  firma_id_proceso?: number | null;
  firma_id_documento?: number | null;
  firma_estado?: "sin_iniciar" | "pendiente" | "firmada" | "rechazada" | string | null;
  firma_url_empleador?: string | null;
  firma_iniciada_at?: string | null;
  firma_completada_at?: string | null;
  vehicle_id?: string | null;
  vehicle_plate?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
};

const LIQUIDACIONES_BUCKET = "Liquidaciones";
const LIQUIDACION_COLUMNS = "*";
const SUPABASE_DIRECT_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://ywcgtwlhievzgflmncsq.supabase.co";

function normalizeStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(
    /^https?:\/\/[^/]+\/supabase\//i,
    `${SUPABASE_DIRECT_URL.replace(/\/$/, "")}/`
  );
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
    file_url: normalizeStorageUrl(row.file_url ? String(row.file_url) : null),
    enviado_por: row.enviado_por ? String(row.enviado_por) : null,
    created_at: String(row.created_at),
    firma_id_proceso: row.firma_id_proceso != null ? Number(row.firma_id_proceso) : null,
    firma_id_documento: row.firma_id_documento != null ? Number(row.firma_id_documento) : null,
    firma_estado: row.firma_estado ? String(row.firma_estado) : "sin_iniciar",
    firma_url_empleador: row.firma_url_empleador ? String(row.firma_url_empleador) : null,
    firma_iniciada_at: row.firma_iniciada_at ? String(row.firma_iniciada_at) : null,
    firma_completada_at: row.firma_completada_at ? String(row.firma_completada_at) : null,
    vehicle_id: row.vehicle_id ? String(row.vehicle_id) : null,
    vehicle_plate: row.vehicle_plate ? String(row.vehicle_plate) : null,
    vehicle_make: row.vehicle_make ? String(row.vehicle_make) : null,
    vehicle_model: row.vehicle_model ? String(row.vehicle_model) : null,
    vehicle_year: row.vehicle_year != null ? Number(row.vehicle_year) : null,
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

export async function guardarLiquidacionPendiente(
  resultado: ResultadoNomina,
  mes: string,
  fecha: string,
  pdfBlob: Blob | null,
): Promise<LiquidacionRecord> {
  const profileId = await resolveProfileId(resultado.trabajadorId);

  let fileUrl: string | null = null;
  if (pdfBlob) {
    const fileKey = `${profileId}/liquidacion-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(LIQUIDACIONES_BUCKET)
      .upload(fileKey, pdfBlob, { upsert: true, contentType: "application/pdf" });

    if (uploadError) {
      console.warn(`No se pudo subir PDF preliminar: ${uploadError.message}`);
    } else {
      const { data: publicUrlData } = supabase.storage.from(LIQUIDACIONES_BUCKET).getPublicUrl(fileKey);
      fileUrl = normalizeStorageUrl(publicUrlData?.publicUrl ?? null);
    }
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
      firma_estado: "sin_iniciar",
      vehicle_id: resultado.vehicle_id || null,
      vehicle_plate: resultado.vehicle_plate || null,
      vehicle_make: resultado.vehicle_make || null,
      vehicle_model: resultado.vehicle_model || null,
      vehicle_year: resultado.vehicle_year || null,
    })
    .select(LIQUIDACION_COLUMNS)
    .single();

  assertNoError(error);
  return toRecord(data as Record<string, unknown>);
}

export async function actualizarFirmaIniciada(
  idLiquidacion: string,
  datos: {
    idProceso: number;
    idDocumento: number;
    urlEmpleador: string;
  }
): Promise<LiquidacionRecord> {
  const { data, error } = await supabase
    .from("liquidaciones")
    .update({
      firma_id_proceso: datos.idProceso,
      firma_id_documento: datos.idDocumento,
      firma_url_empleador: datos.urlEmpleador,
      firma_estado: "pendiente",
      firma_iniciada_at: new Date().toISOString(),
    })
    .eq("id", idLiquidacion)
    .select(LIQUIDACION_COLUMNS)
    .single();

  assertNoError(error);
  return toRecord(data as Record<string, unknown>);
}

export async function obtenerPdfBase64DeLiquidacion(liq: LiquidacionRecord): Promise<string> {
  if (liq.file_url) {
    try {
      const match = liq.file_url.match(/\/Liquidaciones\/(.+)$/);
      if (match && match[1]) {
        const fileKey = decodeURIComponent(match[1]);
        const { data: blob, error } = await supabase.storage
          .from(LIQUIDACIONES_BUCKET)
          .download(fileKey);
        if (!error && blob) {
          const base64 = await blobToBase64(blob);
          if (base64) return base64;
        }
      }
    } catch (err) {
      console.warn("No se pudo descargar el PDF almacenado, se regenerará:", err);
    }
  }

  const partesNombre = (liq.nombre || "Conductor").trim().split(/\s+/);
  const nombre = partesNombre[0] || "Conductor";
  const apellidoPaterno = partesNombre[1] || "Registrado";
  const apellidoMaterno = partesNombre.slice(2).join(" ");

  const pdfService = new PdfLiquidacionService();
  const generado = await pdfService.generarPdfLiquidacion({
    idLiquidacion: liq.id,
    periodoMes: liq.mes,
    fechaEmision: liq.fecha,
    empleado: {
      trabajadorId: liq.worker_id,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      rut: liq.rut || "11.111.111-1",
      email: liq.email || "sin-correo@transporteselmontanez.cl",
    },
    empleador: {
      razonSocial: "TRANSPORTES EL MONTAÑEZ",
      rut: "77.611.481-2",
      nombreRepresentante: "Transportes El Montañez",
      apellidoPaternoRepresentante: "SpA",
      emailRepresentante: "benhantscheruk@gmail.com",
    },
    totalFacturado: liq.total_facturado,
    descuentosPrimarios: liq.descuentos_primarios,
    subtotal: liq.total_facturado ?? liq.subtotal,
    descuentosSecundarios: liq.descuentos_secundarios,
    totalDescuentos: liq.total_descuentos,
    totalAPagar: liq.total_a_pagar,
  });

  return generado.base64;
}

export async function subirYEnviarPdfFirmado(params: {
  archivoPdf: File;
  idLiquidacion?: string | null;
  liquidacionExistente?: LiquidacionRecord | null;
  resultado?: ResultadoNomina;
  mes?: string;
  fecha?: string;
}): Promise<LiquidacionRecord> {
  const { archivoPdf, idLiquidacion, liquidacionExistente, resultado, mes, fecha } = params;

  let profileId: string;
  if (liquidacionExistente?.profile_id) {
    profileId = liquidacionExistente.profile_id;
  } else if (resultado?.trabajadorId) {
    profileId = await resolveProfileId(resultado.trabajadorId);
  } else if (idLiquidacion) {
    const { data: existingRow, error: fetchErr } = await supabase
      .from("liquidaciones")
      .select("profile_id")
      .eq("id", idLiquidacion)
      .single();
    assertNoError(fetchErr);
    profileId = String((existingRow as Record<string, unknown>).profile_id);
  } else {
    throw new Error("Falta información del conductor para asociar la liquidación firmada.");
  }

  const fileKey = `${profileId}/liquidacion-firmada-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(LIQUIDACIONES_BUCKET)
    .upload(fileKey, archivoPdf, { upsert: true, contentType: "application/pdf" });

  if (uploadError) {
    throw new Error(`No se pudo subir el PDF firmado: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(LIQUIDACIONES_BUCKET).getPublicUrl(fileKey);
  const fileUrl = normalizeStorageUrl(publicUrlData?.publicUrl ?? null);

  const targetId = idLiquidacion || liquidacionExistente?.id;
  if (targetId) {
    const { data, error } = await supabase
      .from("liquidaciones")
      .update({
        file_url: fileUrl,
        firma_estado: "firmada",
        firma_completada_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .select(LIQUIDACION_COLUMNS)
      .single();

    assertNoError(error);
    return toRecord(data as Record<string, unknown>);
  }

  if (!resultado || !mes || !fecha) {
    throw new Error("Datos de nómina incompletos para crear el registro firmado.");
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
      firma_estado: "firmada",
      firma_completada_at: new Date().toISOString(),
      vehicle_id: resultado.vehicle_id || null,
      vehicle_plate: resultado.vehicle_plate || null,
      vehicle_make: resultado.vehicle_make || null,
      vehicle_model: resultado.vehicle_model || null,
      vehicle_year: resultado.vehicle_year || null,
    })
    .select(LIQUIDACION_COLUMNS)
    .single();

  assertNoError(error);
  return toRecord(data as Record<string, unknown>);
}

export async function fetchLiquidacionesPendientesFirma(): Promise<LiquidacionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("liquidaciones")
      .select(LIQUIDACION_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error consultando liquidaciones pendientes de firma:", error.message);
      return [];
    }

    const todos = ((data ?? []) as Record<string, unknown>[]).map(toRecord);
    return todos.filter(
      (liq) => liq.firma_estado !== "firmada" && String(liq.firma_estado) !== "1"
    );
  } catch (error) {
    console.warn("Excepción al consultar liquidaciones pendientes de firma:", error);
    return [];
  }
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
    fileUrl = normalizeStorageUrl(publicUrlData?.publicUrl ?? null);
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
      firma_estado: "firmada",
      vehicle_id: resultado.vehicle_id || null,
      vehicle_plate: resultado.vehicle_plate || null,
      vehicle_make: resultado.vehicle_make || null,
      vehicle_model: resultado.vehicle_model || null,
      vehicle_year: resultado.vehicle_year || null,
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
    .eq("firma_estado", "firmada")
    .order("created_at", { ascending: false });

  assertNoError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(toRecord);
}

export async function fetchAllLiquidaciones(): Promise<LiquidacionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("liquidaciones")
      .select(LIQUIDACION_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error consultando todas las liquidaciones:", error.message);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[]).map(toRecord);
  } catch (error) {
    console.warn("Excepción al consultar liquidaciones:", error);
    return [];
  }
}

export async function deleteLiquidacion(id: string): Promise<void> {
  const { error } = await supabase
    .from("liquidaciones")
    .delete()
    .eq("id", id);

  assertNoError(error);
}

export type FinancialSummary = {
  // Egreso (Salida de dinero)
  totalAPagar: number;

  // Ingresos y Recuperaciones
  totalFacturado: number;

  // Recuperación de gastos (Diesel, Seguro, Mantención, Gasto operacional)
  recuperacionGastos: {
    diesel: number;
    seguro: number;
    mantencion: number;
    gastoOperacional: number;
    tag: number;
    total: number;
  };

  // Recuperación de deudas (Anticipo, Préstamo)
  recuperacionDeudas: {
    anticipo: number;
    prestamo: number;
    total: number;
  };

  // Ingreso interno (Arriendo)
  ingresoInterno: {
    arriendo: number;
    total: number;
  };

  // Totales
  totalRecuperaciones: number; // Gastos + Deudas
  totalIngresoMasRecuperaciones: number; // Facturado + Recuperaciones + Arriendo
  cantidadLiquidaciones: number;
};

export function calcularResumenFinanciero(liquidaciones: LiquidacionRecord[]): FinancialSummary {
  let totalFacturado = 0;
  let totalAPagar = 0;

  let diesel = 0;
  let seguro = 0;
  let mantencion = 0;
  let gastoOperacional = 0;
  let tag = 0;

  let anticipo = 0;
  let prestamo = 0;

  let arriendo = 0;

  for (const liq of liquidaciones) {
    totalFacturado += liq.total_facturado || 0;
    totalAPagar += liq.total_a_pagar || 0;

    // Descuentos primarios
    for (const d of liq.descuentos_primarios || []) {
      const c = (d.concepto || "").toLowerCase();
      const m = Number(d.monto) || 0;
      if (c.includes("diesel")) {
        diesel += m;
      } else if (c.includes("seguro")) {
        seguro += m;
      } else if (c.includes("gasto operacional")) {
        gastoOperacional += m;
      } else if (c.includes("arriendo")) {
        arriendo += m;
      } else if (c.includes("tag")) {
        tag += m;
      }
    }

    // Descuentos secundarios
    for (const d of liq.descuentos_secundarios || []) {
      const c = (d.concepto || "").toLowerCase();
      const m = Number(d.monto) || 0;
      if (c.includes("mantenci")) {
        mantencion += m;
      } else if (c.includes("anticipo")) {
        anticipo += m;
      } else if (c.includes("prestamo") || c.includes("préstamo")) {
        prestamo += m;
      }
    }
  }

  const totalGastos = diesel + seguro + mantencion + gastoOperacional + tag;
  const totalDeudas = anticipo + prestamo;
  const totalArriendo = arriendo;

  return {
    totalAPagar,
    totalFacturado,
    recuperacionGastos: {
      diesel,
      seguro,
      mantencion,
      gastoOperacional,
      tag,
      total: totalGastos,
    },
    recuperacionDeudas: {
      anticipo,
      prestamo,
      total: totalDeudas,
    },
    ingresoInterno: {
      arriendo,
      total: totalArriendo,
    },
    totalRecuperaciones: totalGastos + totalDeudas,
    totalIngresoMasRecuperaciones: totalFacturado,
    cantidadLiquidaciones: liquidaciones.length,
  };
}

