// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

// ---------------------------------------------------------------------------
// Configuración de FirmaWeb (Privada en el Servidor)
// ---------------------------------------------------------------------------
function getFirmaWebCredentials() {
  const env = Deno.env.get("FIRMAWEB_ENV") || "dev";
  const baseUrl =
    Deno.env.get("FIRMAWEB_BASE_URL") ||
    (env === "prod"
      ? "https://sistema.firmaweb.app/apifw/v1"
      : "https://testing.firmaweb.app/apifw/v1");

  const user = Deno.env.get("FIRMAWEB_USER");
  const pass = Deno.env.get("FIRMAWEB_PASS");
  let authBase64 = Deno.env.get("FIRMAWEB_AUTH_BASE64");

  if (!authBase64 && user && pass) {
    authBase64 = btoa(`${user}:${pass}`);
  }

  if (!authBase64) {
    throw new Error("Credenciales de FirmaWeb no configuradas en las variables del servidor.");
  }

  return { baseUrl, authBase64 };
}

// ---------------------------------------------------------------------------
// Helper: Obtener Token JWT de FirmaWeb
// ---------------------------------------------------------------------------
async function obtenerToken(baseUrl: string, authBase64: string): Promise<string> {
  const res = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authBase64}`,
    },
  });

  const data = await res.json();
  if (data.Estado !== 1 || !data.Token) {
    throw new Error(`Error obteniendo token de FirmaWeb [Estado ${data.Estado}]: ${data.Mensaje}`);
  }

  return data.Token;
}

// ---------------------------------------------------------------------------
// Servidor Principal
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const actionParam = url.searchParams.get("action");
    const { baseUrl, authBase64 } = getFirmaWebCredentials();

    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = actionParam || body.action || "iniciar-firma";

    // -----------------------------------------------------------------------
    // ACCIÓN 1: CONSULTAR SALDO (Gratuito, no gasta firmas)
    // -----------------------------------------------------------------------
    if (action === "consultar-saldo") {
      const token = await obtenerToken(baseUrl, authBase64);
      const res = await fetch(`${baseUrl}/consultar_saldos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const saldos = await res.json();
      return json({
        success: true,
        fes_disponibles: saldos.fes_disponibles ?? 0,
        fao_disponibles: saldos.fao_disponibles ?? 0,
      });
    }

    // -----------------------------------------------------------------------
    // ACCIÓN 2: INICIAR PROCESO DE FIRMA DE LIQUIDACIÓN
    // -----------------------------------------------------------------------
    if (action === "iniciar-firma") {
      const { resultado, pdfBase64, empleador, urlsRetorno, idLiquidacion } = body;

      if (!resultado || !pdfBase64) {
        return json({ error: "Faltan parámetros requeridos (resultado o pdfBase64)." }, 400);
      }

      // 0. Si se proporcionó idLiquidacion, verificar que no esté ya firmada
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (idLiquidacion && supabaseUrl && serviceRoleKey) {
        try {
          const checkUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/liquidaciones?id=eq.${idLiquidacion}&select=firma_estado`;
          const checkRes = await fetch(checkUrl, {
            headers: {
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
          });
          const rows = await checkRes.json();
          if (Array.isArray(rows) && rows[0]?.firma_estado === "firmada") {
            throw new Error("Esta liquidación ya ha sido firmada por el empleador y no puede volver a firmarse.");
          }
        } catch (checkErr: any) {
          if (checkErr.message?.includes("ya ha sido firmada")) {
            throw checkErr;
          }
        }
      }

      // 1. Obtener Token
      const token = await obtenerToken(baseUrl, authBase64);

      // 2. Crear Proceso (hojaFinal: 0 para no agregar páginas extra)
      const resProceso = await fetch(`${baseUrl}/crear_proceso`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: `Liquidación - ${resultado.nombre} - ${resultado.mes || "Mes Actual"}`,
          notificar: 1,
          etiqueta: "NOMINA",
          geolocalizar: 1,
          hojaFinal: 1,
        }),
      });
      const procesoData = await resProceso.json();
      if (procesoData.Estado !== 1) {
        throw new Error(`Error en crear_proceso [Estado ${procesoData.Estado}]: ${procesoData.Mensaje}`);
      }

      const idProceso = procesoData.IdProceso;
      const idGrupo = procesoData.IdGrupo;

      // 3. Agregar Documento (Base64)
      const nombreArchivo = `Liquidacion_${resultado.trabajadorId || "doc"}.pdf`;
      const resDoc = await fetch(`${baseUrl}/agregar_documento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          idProceso,
          idGrupo,
          nombre: nombreArchivo,
          documento: pdfBase64,
        }),
      });
      const docData = await resDoc.json();
      if (docData.Estado !== 1) {
        throw new Error(`Error en agregar_documento [Estado ${docData.Estado}]: ${docData.Mensaje}`);
      }

      const idDocumento = docData.IdDocumento;

      // 4. Agregar Único Firmante: Empleador (Transportes El Montañez SpA)
      // Conforme a la legislación laboral chilena, el empleador firma y valida legalmente la liquidación.
      // Al usar hojaFinal: 1, FirmaWeb anexa una hoja final automática y posiciona las rúbricas sin requerir coordenadas.
      const defaultEmail = Deno.env.get("FIRMAWEB_EMPLEADOR_EMAIL") || "benhantscheruk@gmail.com";
      const empData = {
        nombre: empleador?.nombre || "Transportes El Montañez",
        apellidoPaterno: empleador?.apellidoPaterno || "SpA",
        apellidoMaterno: empleador?.apellidoMaterno || "",
        rut: empleador?.rut || "77.777.777-7",
        email: empleador?.email || defaultEmail,
      };

      const resFirmante = await fetch(`${baseUrl}/agregar_firmante`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          idProceso,
          idGrupo,
          nombre: empData.nombre,
          apellidoPaterno: empData.apellidoPaterno,
          apellidoMaterno: empData.apellidoMaterno,
          rut: empData.rut,
          email: empData.email,
          tipoFirma: 2, // FES (Firma Electrónica Simple en FirmaWeb)
        }),
      });

      const firmanteData = await resFirmante.json();
      if (firmanteData.Estado !== 1) {
        throw new Error(`Error en agregar_firmante [Estado ${firmanteData.Estado}]: ${firmanteData.Mensaje}`);
      }

      // 5. Iniciar Proceso de Firma
      const webhookBase = `${supabaseUrl ? supabaseUrl.replace(/\/$/, "") : ""}/functions/v1/firmaweb?action=webhook`;

      const resInicio = await fetch(`${baseUrl}/iniciar_proceso`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          idProceso,
          urlCorrecto: urlsRetorno?.correcto || "https://app.transporteselmontanez.cl/firma-exitosa",
          urlCancelado: urlsRetorno?.cancelado || "https://app.transporteselmontanez.cl/firma-cancelada",
          urlNotifica: urlsRetorno?.notifica || webhookBase,
          horasCaduca: 72,
        }),
      });

      const inicioData = await resInicio.json();
      if (inicioData.Estado !== 1) {
        throw new Error(`Error en iniciar_proceso [Estado ${inicioData.Estado}]: ${inicioData.Mensaje}`);
      }

      console.log(`[FirmaWeb Edge] Proceso #${idProceso} iniciado con éxito para el Empleador!`);

      const firmantes: Array<{ Email: string; Url: string; Notificado: string }> = inicioData.Firmantes || [];
      const urlEmpleador = firmantes[0]?.Url ?? "";

      // 6. Si se proporcionó idLiquidacion, registrar en la base de datos Supabase
      if (idLiquidacion && supabaseUrl) {
        try {
          const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/liquidaciones?id=eq.${idLiquidacion}`;
          await fetch(restUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({
              firma_id_proceso: idProceso,
              firma_id_documento: idDocumento,
              firma_estado: "pendiente",
              firma_url_empleador: urlEmpleador,
              firma_iniciada_at: new Date().toISOString(),
            }),
          });
        } catch (dbErr) {
          console.warn("[FirmaWeb Edge] No se pudo actualizar liquidación en BD:", dbErr);
        }
      }

      return json({
        success: true,
        idProceso,
        idGrupo,
        idDocumento,
        firmantes,
      });
    }

    // -----------------------------------------------------------------------
    // ACCIÓN 3: WEBHOOK RECEPTOR (Llamado automáticamente por FirmaWeb)
    // -----------------------------------------------------------------------
    if (action === "webhook") {
      console.log("[FirmaWeb Webhook] Notificación recibida de FirmaWeb:", body);
      const { IdDocumento, Estado } = body;

      if (Estado === 1 && IdDocumento) {
        const token = await obtenerToken(baseUrl, authBase64);
        const resDescarga = await fetch(`${baseUrl}/descargar_documento`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ idDocumento: IdDocumento }),
        });

        const descargaData = await resDescarga.json();
        if (descargaData.Estado === 1 && descargaData.Documento) {
          console.log(`[FirmaWeb Webhook] Documento #${IdDocumento} firmado descargado con éxito.`);

          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

          if (supabaseUrl && serviceRoleKey) {
            // Buscar liquidación asociada
            const searchUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/liquidaciones?firma_id_documento=eq.${IdDocumento}&select=id,worker_id,profile_id`;
            const searchRes = await fetch(searchUrl, {
              headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
            });
            const rows = await searchRes.json();

            if (Array.isArray(rows) && rows.length > 0) {
              const row = rows[0];
              const profileId = row.profile_id || row.worker_id;
              const fileKey = `${profileId}/liquidacion-firmada-${Date.now()}.pdf`;

              // Guardar en Storage bucket "Liquidaciones"
              const binary = Uint8Array.from(atob(descargaData.Documento), (c) => c.charCodeAt(0));
              const storageUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/Liquidaciones/${fileKey}`;
              await fetch(storageUrl, {
                method: "POST",
                headers: {
                  "apikey": serviceRoleKey,
                  "Authorization": `Bearer ${serviceRoleKey}`,
                  "Content-Type": "application/pdf",
                  "x-upsert": "true",
                },
                body: binary,
              });

              const publicUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/Liquidaciones/${fileKey}`;

              // Mantener en 'pendiente' hasta que el administrador suba y envíe manualmente el PDF firmado al conductor
              const updateUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/liquidaciones?id=eq.${row.id}`;
              await fetch(updateUrl, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": serviceRoleKey,
                  "Authorization": `Bearer ${serviceRoleKey}`,
                  "Prefer": "return=minimal",
                },
                body: JSON.stringify({
                  firma_estado: "pendiente",
                  firma_completada_at: new Date().toISOString(),
                }),
              });

              console.log(`[FirmaWeb Webhook] Firma recibida para liquidación #${row.id} (esperando envío manual de PDF firmado al conductor).`);
            }
          }
        }
      }

      return json({ success: true });
    }

    return json({ error: `Acción '${action}' no reconocida` }, 400);
  } catch (error: any) {
    console.error("[FirmaWeb Edge Error]:", error);
    return json({ error: error.message || "Error interno en FirmaWeb Edge Function" }, 500);
  }
});
