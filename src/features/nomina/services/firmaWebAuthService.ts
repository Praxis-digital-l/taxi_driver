import { supabase } from "@/integrations/supabase/client";

export class FirmaWebError extends Error {
  status?: number;
  detalle?: string;

  constructor(mensaje: string, status?: number, detalle?: string) {
    super(mensaje);
    this.name = "FirmaWebError";
    this.status = status;
    this.detalle = detalle;
  }
}

export class FirmaWebCredencialesError extends FirmaWebError {
  constructor(detalle?: string) {
    super(
      "Credenciales de FirmaWeb inválidas (HTTP 401). Revise FIRMAWEB_USER / FIRMAWEB_PASS en los secrets de Supabase.",
      401,
      detalle,
    );
    this.name = "FirmaWebCredencialesError";
  }
}

export class FirmaWebSinCredencialesError extends FirmaWebError {
  constructor() {
    super(
      "Falta configurar las credenciales de FirmaWeb (FIRMAWEB_USER / FIRMAWEB_PASS) en los secrets de Supabase.",
    );
    this.name = "FirmaWebSinCredencialesError";
  }
}

export function firmaWebDisponible(): boolean {
  if (String(import.meta.env.VITE_USE_MOCK_SUPABASE ?? "").toLowerCase() === "true") return false;
  const funciones = (supabase as { functions?: { invoke?: unknown } } | null)?.functions;
  return typeof funciones?.invoke === "function";
}

export async function invocarFirmaWeb(operacion: string, cuerpo: unknown): Promise<unknown> {
  if (!firmaWebDisponible()) {
    throw new FirmaWebError("FirmaWeb no está disponible en modo mock. Usa una conexión real a Supabase.");
  }

  const { data, error } = await supabase.functions.invoke("firmaweb", {
    body: { operacion, cuerpo },
  });

  if (error) {
    const err = error as { message?: string; context?: { status?: number } };
    const status = err.context?.status;

    if (status === 401) throw new FirmaWebCredencialesError(err.message);
    if (status === 429) {
      throw new FirmaWebError("Demasiadas solicitudes a FirmaWeb (HTTP 429).", 429, err.message);
    }
    if (status === 500) throw new FirmaWebError("La función FirmaWeb falló.", 500, err.message);
    throw new FirmaWebError(err.message ?? "No se pudo conectar con FirmaWeb.", status, err.message);
  }

  return data;
}

export function leerCampo(obj: unknown, nombres: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const registro = obj as Record<string, unknown>;
  for (const nombre of nombres) {
    const valor = registro[nombre];
    if (typeof valor === "string" && valor.trim() !== "") return valor;
    if (typeof valor === "number" && !Number.isNaN(valor)) return String(valor);
  }
  return undefined;
}