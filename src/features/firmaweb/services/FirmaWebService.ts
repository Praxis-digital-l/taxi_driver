/**
 * Servicio de integración con la API REST de FirmaWeb
 * Implementación orientada a objetos con gestión de JWT en memoria,
 * reintentos inteligentes y manejo estricto de errores tipados.
 */

import {
  IFirmaWebConfig,
  FirmaWebTokenSuccessResponse,
  CrearProcesoRequest,
  CrearProcesoSuccessResponse,
  AgregarDocumentoRequest,
  AgregarDocumentoResponse,
  AgregarFirmanteRequest,
  AgregarFirmanteResponse,
  IniciarProcesoRequest,
  IniciarProcesoResponse,
  DescargarDocumentoRequest,
  DescargarDocumentoResponse,
  ConsultarSaldosResponse,
  NotificarMovilRequest,
  NotificarMovilResponse,
} from "../types/firmaweb.types";
import {
  FirmaWebError,
  FirmaWebAuthError,
  FirmaWebRateLimitError,
  FirmaWebInsufficientSignaturesError,
  FirmaWebBusinessError,
} from "../errors/firmaweb.errors";
import { loadFirmaWebConfigFromEnv } from "../config/firmaweb.config";

export interface IFirmaWebService {
  obtenerToken(): Promise<FirmaWebTokenSuccessResponse>;
  crearProceso(payload: CrearProcesoRequest): Promise<CrearProcesoSuccessResponse>;
  agregarDocumento(payload: AgregarDocumentoRequest): Promise<AgregarDocumentoResponse>;
  agregarFirmante(payload: AgregarFirmanteRequest): Promise<AgregarFirmanteResponse>;
  iniciarProceso(payload: IniciarProcesoRequest): Promise<IniciarProcesoResponse>;
  descargarDocumento(payload: DescargarDocumentoRequest): Promise<DescargarDocumentoResponse>;
  consultarSaldos(): Promise<ConsultarSaldosResponse>;
  notificarMovil(payload: NotificarMovilRequest): Promise<NotificarMovilResponse>;
}

export class FirmaWebService implements IFirmaWebService {
  private readonly config: IFirmaWebConfig;
  private readonly baseUrl: string;

  // Estado del JWT en memoria (válido por 15 minutos)
  private cachedToken: string | null = null;
  private tokenExpiresAtUnix: number | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  /**
   * @param customConfig Configuración opcional inyectada. Si no se provee, se lee del entorno.
   * @param customFetch Cliente fetch inyectable para pruebas unitarias.
   */
  constructor(
    customConfig?: Partial<IFirmaWebConfig>,
    private readonly customFetch: typeof fetch = fetch.bind(globalThis)
  ) {
    this.config = loadFirmaWebConfigFromEnv(customConfig);
    this.baseUrl = this.config.baseUrl!;
  }

  // =========================================================================
  // 1. GESTIÓN DE TOKEN Y AUTENTICACIÓN
  // =========================================================================

  /**
   * Obtiene un token JWT válido, utilizando la memoria caché o renovándolo
   * automáticamente si ya expiró (con margen de seguridad de 60 segundos).
   * Implementa deduplicación de promesas para evitar múltiples llamadas concurrentes.
   */
  public async getValidToken(): Promise<string> {
    const nowUnix = Math.floor(Date.now() / 1000);
    const margenSeguridadSegundos = 60;

    if (
      this.cachedToken &&
      this.tokenExpiresAtUnix &&
      nowUnix < this.tokenExpiresAtUnix - margenSeguridadSegundos
    ) {
      return this.cachedToken;
    }

    // Deduplicación de solicitud en vuelo para respetar el límite de 5 req/min en /token
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      try {
        const response = await this.obtenerToken();
        this.cachedToken = response.Token;
        this.tokenExpiresAtUnix = response.Expira_en;
        return this.cachedToken;
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  /**
   * Invalida el token en memoria para forzar una renovación inmediata
   */
  public invalidarTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAtUnix = null;
  }

  /**
   * Endpoint de autenticación: POST /token
   * Admite máximo 5 req/min.
   */
  public async obtenerToken(): Promise<FirmaWebTokenSuccessResponse> {
    const endpoint = "/token";
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.config.authBase64}`,
    };

    const response = await this.executeFetch(url, {
      method: "POST",
      headers,
    }, 0, endpoint);

    const data = await response.json();

    if (response.status === 401 || data.Estado === 93) {
      throw new FirmaWebAuthError(data.Mensaje || "No autorizado para generar token", endpoint);
    }

    if (response.status === 429 || data.Estado === 429) {
      const retryAfter = this.parseRetryAfter(response.headers.get("Retry-After"));
      throw new FirmaWebRateLimitError(data.Mensaje || "Demasiados intentos en /token", retryAfter, endpoint);
    }

    this.validarRespuestaEstado(data, endpoint);

    return data as FirmaWebTokenSuccessResponse;
  }

  // =========================================================================
  // 2. MÉTODOS DEL API FIRMAWEB
  // =========================================================================

  /**
   * POST /crear_proceso
   * Crea un nuevo contenedor de firma para uno o más documentos.
   */
  public async crearProceso(payload: CrearProcesoRequest): Promise<CrearProcesoSuccessResponse> {
    const data = await this.authenticatedRequest<CrearProcesoSuccessResponse>("/crear_proceso", payload);
    return data;
  }

  /**
   * POST /agregar_documento
   * Asocia un documento en formato Base64 al proceso creado.
   */
  public async agregarDocumento(payload: AgregarDocumentoRequest): Promise<AgregarDocumentoResponse> {
    return this.authenticatedRequest<AgregarDocumentoResponse>("/agregar_documento", payload);
  }

  /**
   * POST /agregar_firmante
   * Registra un firmante con sus posiciones y tipo de firma (FES/FAO).
   */
  public async agregarFirmante(payload: AgregarFirmanteRequest): Promise<AgregarFirmanteResponse> {
    return this.authenticatedRequest<AgregarFirmanteResponse>("/agregar_firmante", payload);
  }

  /**
   * POST /iniciar_proceso
   * Dispara el flujo de firma y retorna las URLs únicas para cada participante.
   */
  public async iniciarProceso(payload: IniciarProcesoRequest): Promise<IniciarProcesoResponse> {
    return this.authenticatedRequest<IniciarProcesoResponse>("/iniciar_proceso", payload);
  }

  /**
   * POST /descargar_documento
   * Descarga el documento ya firmado en Base64.
   */
  public async descargarDocumento(payload: DescargarDocumentoRequest): Promise<DescargarDocumentoResponse> {
    return this.authenticatedRequest<DescargarDocumentoResponse>("/descargar_documento", payload);
  }

  /**
   * POST /consultar_saldos
   * Consulta el saldo de firmas disponibles en la cuenta.
   */
  public async consultarSaldos(): Promise<ConsultarSaldosResponse> {
    return this.authenticatedRequest<ConsultarSaldosResponse>("/consultar_saldos", {});
  }

  /**
   * POST /notificar_movil
   * Envía una notificación móvil o recordatorio al firmante.
   */
  public async notificarMovil(payload: NotificarMovilRequest): Promise<NotificarMovilResponse> {
    return this.authenticatedRequest<NotificarMovilResponse>("/notificar_movil", payload);
  }

  // =========================================================================
  // 3. COMUNICACIÓN HTTP Y CONTROL DE ERRORES
  // =========================================================================

  /**
   * Realiza una petición POST autenticada con Bearer Token, gestionando renovación
   * en caso de expiración inesperada y control de reintentos por HTTP 429.
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    body: unknown,
    isRetryAfterAuthFailure = false
  ): Promise<T> {
    const token = await this.getValidToken();
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    const response = await this.executeFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, 0, endpoint);

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      throw new FirmaWebError(`Respuesta inválida no-JSON recibida de ${endpoint} (HTTP ${response.status})`, {
        statusCode: response.status,
        endpoint,
      });
    }

    // Si el token expiró en el servidor antes de lo esperado, intentar renovar 1 vez
    if ((response.status === 401 || data.Estado === 93) && !isRetryAfterAuthFailure) {
      this.invalidarTokenCache();
      return this.authenticatedRequest<T>(endpoint, body, true);
    }

    // Validación de Estado de negocio de FirmaWeb
    this.validarRespuestaEstado(data, endpoint);

    return data as T;
  }

  /**
   * Ejecuta fetch con timeout y soporte para backoff ante HTTP 429
   */
  private async executeFetch(
    url: string,
    init: RequestInit,
    attempt = 0,
    endpoint = ""
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 15000);

    try {
      const response = await this.customFetch(url, {
        ...init,
        signal: controller.signal,
      });

      // Manejo de Rate Limit HTTP 429
      if (response.status === 429) {
        const retryAfterSeconds = this.parseRetryAfter(response.headers.get("Retry-After"));
        const maxRetries = this.config.maxRetries ?? 3;

        if (attempt < maxRetries) {
          const waitTimeMs = Math.min(retryAfterSeconds * 1000, 30000); // Límite de espera segura
          await this.sleep(waitTimeMs);
          return this.executeFetch(url, init, attempt + 1, endpoint);
        }

        throw new FirmaWebRateLimitError(
          `Límite de peticiones alcanzado (HTTP 429) en ${endpoint} tras ${attempt} reintentos.`,
          retryAfterSeconds,
          endpoint
        );
      }

      return response;
    } catch (err: unknown) {
      if (err instanceof FirmaWebError) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new FirmaWebError(`Tiempo de espera agotado (${this.config.timeoutMs}ms) al consultar ${endpoint}`, {
          endpoint,
        });
      }
      throw new FirmaWebError(
        `Error de red o conexión al contactar ${endpoint}: ${err instanceof Error ? err.message : String(err)}`,
        { endpoint }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Valida estrictamente que Estado === 1.
   * Lanza errores especializados si Estado === 97 (sin saldo), 93 (no autorizado), etc.
   */
  private validarRespuestaEstado(data: Record<string, unknown>, endpoint: string): void {
    const estado = typeof data.Estado === "number" ? data.Estado : undefined;
    const mensaje = typeof data.Mensaje === "string" ? data.Mensaje : "Sin mensaje de error";

    if (estado === 1) {
      return;
    }

    if (estado === 97) {
      throw new FirmaWebInsufficientSignaturesError(mensaje);
    }

    if (estado === 93) {
      throw new FirmaWebAuthError(mensaje, endpoint);
    }

    if (estado === 429) {
      throw new FirmaWebRateLimitError(mensaje, 60, endpoint);
    }

    throw new FirmaWebBusinessError(estado ?? -1, mensaje, endpoint);
  }

  /**
   * Interpreta el encabezado Retry-After en segundos o fecha HTTP
   */
  private parseRetryAfter(headerValue: string | null): number {
    if (!headerValue) return 60;
    const seconds = parseInt(headerValue, 10);
    if (!isNaN(seconds)) return Math.max(seconds, 1);

    const parsedDate = Date.parse(headerValue);
    if (!isNaN(parsedDate)) {
      const diffSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
      return Math.max(diffSeconds, 1);
    }

    return 60;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

