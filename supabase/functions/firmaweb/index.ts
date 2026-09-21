import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const API_URL = Deno.env.get("FIRMAWEB_API_URL") ?? "https://testing.firmaweb.app/apifw/v1";

const TOKEN_DURACION_MS = 15 * 60 * 1000;
const TOKEN_MARGEN_MS = 60 * 1000;

let tokenCache: string | null = null;
let tokenExpiraEn = 0;

const OPERACIONES = new Set([
  "token",
  "crear_proceso",
  "agregar_documento",
  "agregar_firmante",
  "iniciar_proceso",
  "descargar_documento",
  "consultar_saldos",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function base64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binaria = "";
  for (const byte of bytes) binaria += String.fromCharCode(byte);
  return btoa(binaria);
}

function expiraDelJWT(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const conPadding = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const datos = JSON.parse(atob(conPadding)) as { exp?: unknown };
    return typeof datos.exp === "number" ? datos.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function obtenerToken(): Promise<string> {
  if (tokenCache && Date.now() + TOKEN_MARGEN_MS < tokenExpiraEn) return tokenCache;

  const usuario = Deno.env.get("FIRMAWEB_USER");
  const clave = Deno.env.get("FIRMAWEB_PASS");
  if (!usuario || !clave) {
    throw new Error("FirmaWeb no configurado: faltan FIRMAWEB_USER / FIRMAWEB_PASS en los secrets.");
  }

  const respuesta = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${base64(`${usuario}:${clave}`)}`,
      "Content-Type": "application/json",
    },
  });

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(`FirmaWeb /token respondió HTTP ${respuesta.status}: ${texto.slice(0, 300)}`);
  }

  let datos: Record<string, unknown> = {};
  try {
    datos = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    datos = {};
  }

  const tokenValue = datos.token ?? datos.access_token ?? texto;
  if (typeof tokenValue !== "string" || !tokenValue) {
    throw new Error("FirmaWeb no devolvió un token en /token.");
  }

  tokenCache = tokenValue;
  const exp = typeof tokenValue === "string" ? expiraDelJWT(tokenValue) : null;
  tokenExpiraEn = exp ?? Date.now() + TOKEN_DURACION_MS;
  return tokenValue;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST") {
      return json({ Error: "Método no permitido." }, 405);
    }

    const cuerpo = await req.json().catch(() => null);
    const operacion = typeof cuerpo?.operacion === "string" ? cuerpo.operacion : "";
    if (!OPERACIONES.has(operacion)) {
      return json({ Error: `Operación no soportada: ${operacion}` }, 400);
    }

    const token = await obtenerToken();
    const respuesta = await fetch(`${API_URL}/${operacion}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo?.cuerpo ?? {}),
    });

    const texto = await respuesta.text();
    let dato: unknown = texto;
    try {
      dato = JSON.parse(texto);
    } catch {
      dato = texto;
    }

    return new Response(JSON.stringify(dato), {
      status: respuesta.ok ? 200 : respuesta.status,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    return json({ Error: error instanceof Error ? error.message : "Error interno." }, 500);
  }
});