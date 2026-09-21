import { supabase } from "@/integrations/supabase/client";
import { type ResultadoNomina } from "@/lib/nomina";

export interface SaldoFirmaWeb {
  fes: number;
  fao: number;
}

export interface FirmanteUrlInfo {
  Email: string;
  Url: string;
  Notificado: string;
}

export interface IniciarFirmaWebResponse {
  success: boolean;
  idProceso: number;
  idGrupo: number;
  idDocumento: number;
  firmantes: FirmanteUrlInfo[];
}

/**
 * Consulta el saldo de firmas disponibles en tiempo real.
 * Esta operación es 100% gratuita y NO descuenta ninguna firma.
 */
export async function consultarSaldoFirmaWeb(): Promise<SaldoFirmaWeb> {
  const { data, error } = await supabase.functions.invoke("firmaweb", {
    body: { action: "consultar-saldo" },
  });

  if (error || !data?.success) {
    let errorMsg = error?.message || data?.error || "No se pudo consultar el saldo de FirmaWeb";
    try {
      if (error && "context" in error) {
        const ctx = (error as any).context;
        if (typeof ctx?.json === "function") {
          const body = await ctx.json();
          if (body?.error) errorMsg = body.error;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return {
    fes: data.fes_disponibles ?? 0,
    fao: data.fao_disponibles ?? 0,
  };
}

/**
 * Inicia el proceso de firma electrónica en FirmaWeb a través de la Edge Function.
 * NOTA: Esta operación sí compromete 1 firma del saldo de prueba.
 */
export async function enviarAFirmaWeb(
  resultado: ResultadoNomina,
  pdfBase64: string,
  mes: string
): Promise<IniciarFirmaWebResponse> {
  const { data, error } = await supabase.functions.invoke("firmaweb", {
    body: {
      action: "iniciar-firma",
      resultado: {
        ...resultado,
        mes,
      },
      pdfBase64,
    },
  });

  if (error) {
    let errorMsg = error.message;
    try {
      if ("context" in error) {
        const ctx = (error as any).context;
        if (typeof ctx?.json === "function") {
          const errBody = await ctx.json();
          if (errBody?.error) errorMsg = errBody.error;
          else if (errBody?.message) errorMsg = errBody.message;
        } else if (typeof ctx?.text === "function") {
          const txt = await ctx.text();
          try {
            const parsed = JSON.parse(txt);
            if (parsed?.error) errorMsg = parsed.error;
            else if (parsed?.message) errorMsg = parsed.message;
          } catch {
            if (txt) errorMsg = txt;
          }
        }
      }
    } catch {
      // Ignorar fallback
    }
    throw new Error(errorMsg);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Error al iniciar el proceso en FirmaWeb");
  }

  return data as IniciarFirmaWebResponse;
}

