import { ARRIENDO_ESTANDAR } from "@/lib/nomina";

export { ARRIENDO_ESTANDAR };

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export type PeriodoRendimiento = {
  anio: number;
  mes: number;
};

export type RendimientoActivoInput = {
  arriendo: number;
  seguroTotal: number;
  mantencion: number;
  prorrateo: number;
  revisionTecnica: number;
  repuestos: number;
};

export type RendimientoActivoResultado = {
  arriendo: number;
  seguroTotal: number;
  seguroDescontado: number;
  mantencion: number;
  prorrateo: number;
  revisionTecnica: number;
  repuestos: number;
  totalDescuentos: number;
  rendimiento: number;
};

export function calcularRendimientoActivo(
  input: RendimientoActivoInput
): RendimientoActivoResultado {
  const arriendo = Number(input.arriendo) || 0;
  const seguroTotal = Number(input.seguroTotal) || 0;
  const mantencion = Number(input.mantencion) || 0;
  const prorrateo = Number(input.prorrateo) || 0;
  const revisionTecnica = Number(input.revisionTecnica) || 0;
  const repuestos = Number(input.repuestos) || 0;

  const seguroDescontado = Math.round(seguroTotal * 0.5);
  const totalDescuentos =
    seguroDescontado + mantencion + prorrateo + revisionTecnica + repuestos;

  return {
    arriendo,
    seguroTotal,
    seguroDescontado,
    mantencion,
    prorrateo,
    revisionTecnica,
    repuestos,
    totalDescuentos,
    rendimiento: arriendo - totalDescuentos,
  };
}

export function periodoDesdeFechaRegistro(fecha: Date | string): PeriodoRendimiento {
  const date = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(date.getTime())) {
    const hoy = new Date();
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
  }

  return { anio: date.getFullYear(), mes: date.getMonth() + 1 };
}

export function periodoKey(periodo: PeriodoRendimiento): string {
  return `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`;
}

export function mismoPeriodo(
  a: PeriodoRendimiento,
  b: PeriodoRendimiento
): boolean {
  return a.anio === b.anio && a.mes === b.mes;
}

export function formatearPeriodo(periodo: PeriodoRendimiento): string {
  const nombre = MESES[periodo.mes - 1] || "";
  return `${nombre} ${periodo.anio}`;
}

export function normalizarTexto(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function esDocumentoRepuesto(nombreTipo: string | null | undefined): boolean {
  return normalizarTexto(nombreTipo).includes("repuesto");
}

export function esDocumentoRevisionTecnica(
  nombreTipo: string | null | undefined
): boolean {
  const nombre = normalizarTexto(nombreTipo);
  return nombre.includes("revision") && nombre.includes("tecnic");
}

export function documentoGeneraGasto(nombreTipo: string | null | undefined): boolean {
  return esDocumentoRepuesto(nombreTipo) || esDocumentoRevisionTecnica(nombreTipo);
}

export function parseMontoInput(value: string): number {
  const digits = (value || "").replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function formatMontoInput(value: string | number): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `$ ${Number(digits).toLocaleString("es-CL")}`;
}
