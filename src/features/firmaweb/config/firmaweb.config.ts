/**
 * Configuración y resolución de variables de entorno para FirmaWeb
 */

import { IFirmaWebConfig, FirmaWebEnvironment } from "../types/firmaweb.types";

export const FIRMAWEB_DEV_BASE_URL = "https://testing.firmaweb.app/apifw/v1";
export const FIRMAWEB_PROD_BASE_URL = "https://sistema.firmaweb.app/apifw/v1";

/**
 * Función auxiliar para leer variables de entorno de forma segura en Node.js o Vite
 */
function getEnvVar(key: string): string | undefined {
  if (typeof process !== "undefined" && process?.env && process.env[key]) {
    return process.env[key];
  }
  // Soporte para entornos Vite (import.meta.env) si estuviera disponible
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (metaEnv && metaEnv[key]) {
      return metaEnv[key];
    }
    // Claves prefijadas con VITE_
    const viteKey = `VITE_${key}`;
    if (metaEnv && metaEnv[viteKey]) {
      return metaEnv[viteKey];
    }
  } catch {
    // Silencioso en caso de no soportar import.meta
  }
  return undefined;
}

/**
 * Carga y valida la configuración requerida desde las variables de entorno
 */
export function loadFirmaWebConfigFromEnv(overrides?: Partial<IFirmaWebConfig>): IFirmaWebConfig {
  const envType = (overrides?.environment ||
    getEnvVar("FIRMAWEB_ENV") ||
    "dev") as FirmaWebEnvironment;

  let baseUrl = overrides?.baseUrl || getEnvVar("FIRMAWEB_BASE_URL");
  if (!baseUrl) {
    baseUrl = envType === "prod" ? FIRMAWEB_PROD_BASE_URL : FIRMAWEB_DEV_BASE_URL;
  }

  const user = overrides?.user || getEnvVar("FIRMAWEB_USER");
  const password = overrides?.password || getEnvVar("FIRMAWEB_PASS");
  let authBase64 = overrides?.authBase64 || getEnvVar("FIRMAWEB_AUTH_BASE64");

  if (!authBase64 && user && password) {
    if (typeof Buffer !== "undefined") {
      authBase64 = Buffer.from(`${user}:${password}`).toString("base64");
    } else if (typeof btoa === "function") {
      authBase64 = btoa(`${user}:${password}`);
    }
  }

  if (!authBase64 && (!user || !password)) {
    throw new Error(
      "[FirmaWebConfig] Credenciales no encontradas. Asegúrese de definir FIRMAWEB_USER y FIRMAWEB_PASS, o FIRMAWEB_AUTH_BASE64 en sus variables de entorno."
    );
  }

  return {
    environment: envType,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    user,
    password,
    authBase64,
    timeoutMs: overrides?.timeoutMs ?? Number(getEnvVar("FIRMAWEB_TIMEOUT_MS") || 15000),
    maxRetries: overrides?.maxRetries ?? Number(getEnvVar("FIRMAWEB_MAX_RETRIES") || 3),
  };
}

