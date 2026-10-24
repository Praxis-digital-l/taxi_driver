import { supabase } from "@/integrations/supabase/client";
import { fetchAdminVehiclesData } from "@/features/admin/services/adminVehiclesService";
import {
  fetchAllLiquidaciones,
  type LiquidacionRecord,
} from "@/features/nomina/services/liquidacionesService";
import {
  ARRIENDO_ESTANDAR,
  MESES,
  esDocumentoRepuesto,
  esDocumentoRevisionTecnica,
  mismoPeriodo,
  normalizarTexto,
  type PeriodoRendimiento,
} from "@/lib/rendimientoActivos";

export type AssetDocument = {
  id: string;
  vehicle_id: string | null;
  created_at: string;
  amount: number;
  description: string | null;
  document_type_name: string | null;
};

export type ProrrateoRecord = {
  id: string;
  vehicle_id: string;
  monto: number;
  anio_rendimiento: number;
  mes_rendimiento: number;
  fecha_registro: string;
  created_at: string;
  updated_at: string;
};

export type NominaVehiculoPeriodo = {
  arriendo: number;
  seguroTotal: number;
  mantencion: number;
  liquidacionId: string | null;
  fechaCalculo: string | null;
  tieneNomina: boolean;
};

export type DocumentosVehiculoPeriodo = {
  revisionTecnica: number;
  repuestos: number;
  detalle: AssetDocument[];
};

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function montoConcepto(
  conceptos: { concepto: string; monto: number }[] | null | undefined,
  buscado: string
): number {
  return (conceptos || []).reduce((total, item) => {
    const concepto = normalizarTexto(item.concepto);
    if (concepto.includes(buscado)) {
      return total + (Number(item.monto) || 0);
    }
    return total;
  }, 0);
}

export function obtenerPeriodoLiquidacion(
  liquidacion: LiquidacionRecord
): PeriodoRendimiento {
  const fecha = new Date(liquidacion.created_at);
  const mesCreado = Number.isNaN(fecha.getTime()) ? 1 : fecha.getMonth() + 1;
  const anioCreado = Number.isNaN(fecha.getTime())
    ? new Date().getFullYear()
    : fecha.getFullYear();

  const nombreMes = normalizarTexto(liquidacion.mes);
  const indice = MESES.findIndex((mes) => normalizarTexto(mes) === nombreMes);
  if (indice < 0) {
    return { anio: anioCreado, mes: mesCreado };
  }

  const mes = indice + 1;
  let anio = anioCreado;
  if (mes > mesCreado && mes - mesCreado > 6) {
    anio -= 1;
  } else if (mesCreado > mes && mesCreado - mes > 6) {
    anio += 1;
  }

  return { anio, mes };
}

export function obtenerNominaVehiculoPeriodo(
  liquidaciones: LiquidacionRecord[],
  vehicleId: string,
  periodo: PeriodoRendimiento
): NominaVehiculoPeriodo {
  const candidatas = liquidaciones
    .filter(
      (liq) =>
        liq.vehicle_id === vehicleId &&
        mismoPeriodo(obtenerPeriodoLiquidacion(liq), periodo)
    )
    .sort((a, b) => {
      const fechaA = new Date(a.created_at).getTime();
      const fechaB = new Date(b.created_at).getTime();
      return fechaB - fechaA;
    });

  if (candidatas.length === 0) {
    return {
      arriendo: 0,
      seguroTotal: 0,
      mantencion: 0,
      liquidacionId: null,
      fechaCalculo: null,
      tieneNomina: false,
    };
  }

  const liquidacion = candidatas[0];
  const arriendoNomina = montoConcepto(
    liquidacion.descuentos_primarios,
    "arriendo"
  );
  const seguroTotal = montoConcepto(
    liquidacion.descuentos_primarios,
    "seguro"
  );
  const mantencion = montoConcepto(
    liquidacion.descuentos_secundarios,
    "mantenci"
  );

  return {
    arriendo: arriendoNomina > 0 ? arriendoNomina : 0,
    seguroTotal,
    mantencion,
    liquidacionId: liquidacion.id,
    fechaCalculo: liquidacion.created_at,
    tieneNomina: true,
  };
}

function documentoEnPeriodo(
  documento: AssetDocument,
  periodo: PeriodoRendimiento
): boolean {
  const fecha = new Date(documento.created_at);
  if (Number.isNaN(fecha.getTime())) return false;
  return (
    fecha.getFullYear() === periodo.anio && fecha.getMonth() + 1 === periodo.mes
  );
}

export function obtenerDocumentosVehiculoPeriodo(
  documentos: AssetDocument[],
  vehicleId: string,
  periodo: PeriodoRendimiento
): DocumentosVehiculoPeriodo {
  const detalle = documentos.filter(
    (doc) =>
      doc.vehicle_id === vehicleId &&
      documentoEnPeriodo(doc, periodo) &&
      (esDocumentoRepuesto(doc.document_type_name) ||
        esDocumentoRevisionTecnica(doc.document_type_name))
  );

  return detalle.reduce<DocumentosVehiculoPeriodo>(
    (acc, doc) => {
      if (esDocumentoRepuesto(doc.document_type_name)) {
        acc.repuestos += Number(doc.amount) || 0;
      } else if (esDocumentoRevisionTecnica(doc.document_type_name)) {
        acc.revisionTecnica += Number(doc.amount) || 0;
      }
      return acc;
    },
    { revisionTecnica: 0, repuestos: 0, detalle }
  );
}

export function obtenerProrrateoVehiculoPeriodo(
  prorrateos: ProrrateoRecord[],
  vehicleId: string,
  periodo: PeriodoRendimiento
): ProrrateoRecord | null {
  return (
    prorrateos.find(
      (item) =>
        item.vehicle_id === vehicleId &&
        item.anio_rendimiento === periodo.anio &&
        item.mes_rendimiento === periodo.mes
    ) || null
  );
}

export async function fetchAssetDocuments(): Promise<AssetDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, vehicle_id, created_at, amount, description, document_types(name)")
    .not("vehicle_id", "is", null)
    .order("created_at", { ascending: false });

  assertNoError(error);

  return ((data ?? []) as any[]).map((row) => ({
    id: String(row.id),
    vehicle_id: row.vehicle_id ? String(row.vehicle_id) : null,
    created_at: String(row.created_at),
    amount: Number(row.amount) || 0,
    description: row.description ? String(row.description) : null,
    document_type_name: row.document_types?.name
      ? String(row.document_types.name)
      : null,
  }));
}

export async function fetchVehicleProrrateos(): Promise<ProrrateoRecord[]> {
  const { data, error } = await supabase
    .from("vehicle_prorrateos")
    .select("*")
    .order("anio_rendimiento", { ascending: false })
    .order("mes_rendimiento", { ascending: false });

  assertNoError(error);

  return ((data ?? []) as any[]).map((row) => ({
    id: String(row.id),
    vehicle_id: String(row.vehicle_id),
    monto: Number(row.monto) || 0,
    anio_rendimiento: Number(row.anio_rendimiento),
    mes_rendimiento: Number(row.mes_rendimiento),
    fecha_registro: String(row.fecha_registro),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function upsertVehicleProrrateo(params: {
  vehicleId: string;
  monto: number;
  fechaRegistro: string;
  periodo: PeriodoRendimiento;
}): Promise<ProrrateoRecord> {
  const { data, error } = await supabase
    .from("vehicle_prorrateos")
    .upsert(
      {
        vehicle_id: params.vehicleId,
        monto: params.monto,
        fecha_registro: params.fechaRegistro,
        anio_rendimiento: params.periodo.anio,
        mes_rendimiento: params.periodo.mes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vehicle_id,anio_rendimiento,mes_rendimiento" }
    )
    .select()
    .single();

  assertNoError(error);
  const row = data as any;

  return {
    id: String(row.id),
    vehicle_id: String(row.vehicle_id),
    monto: Number(row.monto) || 0,
    anio_rendimiento: Number(row.anio_rendimiento),
    mes_rendimiento: Number(row.mes_rendimiento),
    fecha_registro: String(row.fecha_registro),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function fetchRendimientoActivosData() {
  const [vehiculosData, liquidaciones, documentos, prorrateos] =
    await Promise.all([
      fetchAdminVehiclesData(),
      fetchAllLiquidaciones(),
      fetchAssetDocuments(),
      fetchVehicleProrrateos(),
    ]);

  return {
    vehicles: vehiculosData.vehicles,
    liquidaciones,
    documentos,
    prorrateos,
  };
}
