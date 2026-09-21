/**
 * Jerarquía de errores fuertemente tipados para FirmaWeb
 */

export class FirmaWebError extends Error {
  public readonly statusCode?: number;
  public readonly apiEstado?: number;
  public readonly apiMensaje?: string;
  public readonly endpoint?: string;

  constructor(message: string, options?: {
    statusCode?: number;
    apiEstado?: number;
    apiMensaje?: string;
    endpoint?: string;
  }) {
    super(message);
    this.name = "FirmaWebError";
    this.statusCode = options?.statusCode;
    this.apiEstado = options?.apiEstado;
    this.apiMensaje = options?.apiMensaje;
    this.endpoint = options?.endpoint;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Error cuando las credenciales no son válidas o el token expiró y no pudo renovarse */
export class FirmaWebAuthError extends FirmaWebError {
  constructor(message = "FirmaWeb: Error de autenticación o credenciales inválidas (Estado 93)", endpoint = "/token") {
    super(message, { statusCode: 401, apiEstado: 93, apiMensaje: message, endpoint });
    this.name = "FirmaWebAuthError";
    Object.setPrototypeOf(this, FirmaWebAuthError.prototype);
  }
}

/** Error cuando se superan los límites de tasa (Rate Limit 429) */
export class FirmaWebRateLimitError extends FirmaWebError {
  public readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 60, endpoint?: string) {
    super(message, { statusCode: 429, apiEstado: 429, apiMensaje: message, endpoint });
    this.name = "FirmaWebRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, FirmaWebRateLimitError.prototype);
  }
}

/** Error cuando la cuenta no cuenta con saldo suficiente de firmas disponibles (Estado 97) */
export class FirmaWebInsufficientSignaturesError extends FirmaWebError {
  constructor(message = "FirmaWeb: No tiene firmas disponibles para realizar esta operación (Estado 97)") {
    super(message, { apiEstado: 97, apiMensaje: message, endpoint: "/crear_proceso" });
    this.name = "FirmaWebInsufficientSignaturesError";
    Object.setPrototypeOf(this, FirmaWebInsufficientSignaturesError.prototype);
  }
}

/** Error general cuando la API responde con un Estado distinto de 1 */
export class FirmaWebBusinessError extends FirmaWebError {
  constructor(apiEstado: number, apiMensaje: string, endpoint?: string) {
    super(`FirmaWeb API error en ${endpoint ?? "endpoint"} [Estado: ${apiEstado}]: ${apiMensaje}`, {
      apiEstado,
      apiMensaje,
      endpoint,
    });
    this.name = "FirmaWebBusinessError";
    Object.setPrototypeOf(this, FirmaWebBusinessError.prototype);
  }
}

