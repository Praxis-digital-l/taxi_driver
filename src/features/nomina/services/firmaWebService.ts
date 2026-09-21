import {
  FirmaWebCredencialesError,
  FirmaWebError,
  invocarFirmaWeb,
  leerCampo,
} from "./firmaWebAuthService";

export type CrearProcesoPayload = {
  nombre: string;
  notificar: 1 | 2;
  hojaFinal: 1 | 0;
  etiqueta?: string;
  geolocalizar?: 1 | 0;
} & Record<string, unknown>;

export type DatosFirmante = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  rut: string;
  email: string;
  tipoFirma: 2;
} & Record<string, unknown>;

export type ProcesoFirma = {
  IdProceso: string;
  IdGrupo: string;
};

export type DocumentoAgregado = {
  IdDocumento: string;
};

export type UrlFirma = {
  url: string;
  email?: string;
  rut?: string;
  nombre?: string;
};

const MENSAJES_ESTADO: Record<number, string> = {
  93: "Credenciales inválidas.",
  94: "Firmas insuficientes.",
  95: "Proceso sin documentos.",
  96: "Documento no disponible.",
  97: "Recurso no encontrado.",
  98: "Sin saldo suficiente.",
  99: "Datos inválidos.",
  100: "Error interno.",
};

function validarEstado(json: unknown): unknown {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const registro = json as Record<string, unknown>;
    const estado = registro.Estado ?? registro.estado;
    if (typeof estado === "number") {
      if (estado === 1) return json;
      if (estado === 93) throw new FirmaWebCredencialesError();
      const mensaje = MENSAJES_ESTADO[estado] ?? `código ${estado}.`;
      throw new FirmaWebError(`FirmaWeb rechazó la operación: ${mensaje}`);
    }
  }
  return json;
}

function esUrl(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim() !== "";
}

function urlDeValor(valor: unknown): string | undefined {
  if (typeof valor === "string") return valor.trim() || undefined;
  if (valor && typeof valor === "object") {
    const registro = valor as Record<string, unknown>;
    return (
      leerCampo(registro, [
        "urlFirma",
        "url_firma",
        "firmaUrl",
        "linkFirma",
        "link",
        "url",
      ]) ?? undefined
    );
  }
  return undefined;
}

function urlsDeRegistro(registro: Record<string, unknown>): UrlFirma[] {
  const urls: UrlFirma[] = [];

  const arrayCampos = ["urlFirmantes", "urlsFirma", "urls", "firmantes", "urlFirmaList"];
  for (const campo of arrayCampos) {
    const valor = registro[campo];
    if (!Array.isArray(valor)) continue;
    for (const item of valor) {
      const url = urlDeValor(item);
      if (!url) continue;
      const itemObj = item && typeof item === "object" ? (item as Record<string, unknown>) : undefined;
      urls.push({
        url,
        email: itemObj ? leerCampo(itemObj, ["email", "correo"]) ?? undefined : undefined,
        rut: itemObj ? leerCampo(itemObj, ["rut"]) ?? undefined : undefined,
        nombre: itemObj ? leerCampo(itemObj, ["nombre", "Nombre", "nombreFirmante"]) ?? undefined : undefined,
      });
    }
  }

  const urlCampos = ["urlFirma", "url_firma", "firmaUrl", "linkFirma", "link", "url", "urlFirmante"];
  for (const campo of urlCampos) {
    const url = urlDeValor(registro[campo]);
    if (url) {
      urls.push({ url });
      break;
    }
  }

  const directa = urlDeValor(registro);
  if (directa && urls.length === 0) urls.push({ url: directa });

  return urls;
}

export function extraerUrlsFirma(json: unknown): UrlFirma[] {
  if (!json || typeof json !== "object") return [];

  const urls = urlsDeRegistro(json as Record<string, unknown>);
  if (urls.length > 0) return urls;

  for (const valor of Object.values(json as Record<string, unknown>)) {
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      const encontradas = urlsDeRegistro(valor as Record<string, unknown>);
      if (encontradas.length > 0) return encontradas;
    }
  }

  return [];
}

async function peticion(operacion: string, cuerpo: unknown): Promise<unknown> {
  return validarEstado(await invocarFirmaWeb(operacion, cuerpo));
}

export class FirmaWebService {
  private static instancia: FirmaWebService | null = null;

  private constructor() {}

  static getInstance(): FirmaWebService {
    if (!this.instancia) this.instancia = new FirmaWebService();
    return this.instancia;
  }

  static resetearInstancia(): void {
    this.instancia = null;
  }

  async crearProceso(payload: CrearProcesoPayload): Promise<ProcesoFirma> {
    const json = await peticion("crear_proceso", payload);
    const IdProceso = leerCampo(json, ["idProceso", "IdProceso", "id_proceso"]);
    const IdGrupo = leerCampo(json, ["idGrupo", "IdGrupo", "id_grupo"]);
    if (!IdProceso || !IdGrupo) {
      throw new FirmaWebError("FirmaWeb no devolvió idProceso ni idGrupo en /crear_proceso.");
    }
    return { IdProceso, IdGrupo };
  }

  async agregarDocumento(
    idProceso: string,
    idGrupo: string,
    pdfBase64: string,
    nombreArchivo: string,
  ): Promise<DocumentoAgregado> {
    const json = await peticion("agregar_documento", {
      idProceso,
      idGrupo,
      nombre: nombreArchivo,
      documento: pdfBase64,
    });
    const IdDocumento = leerCampo(json, ["idDocumento", "IdDocumento", "id_documento"]);
    if (!IdDocumento) {
      throw new FirmaWebError("FirmaWeb no devolvió idDocumento en /agregar_documento.");
    }
    return { IdDocumento };
  }

  async agregarFirmante(idProceso: string, idGrupo: string, datosFirmante: DatosFirmante): Promise<unknown> {
    return peticion("agregar_firmante", {
      idProceso,
      idGrupo,
      ...datosFirmante,
    });
  }

  async iniciarProceso(
    idProceso: string,
    urlCorrecto: string,
    urlCancelado: string,
    urlNotifica: string,
    horasCaduca?: number,
  ): Promise<unknown> {
    return peticion("iniciar_proceso", {
      idProceso,
      urlCorrecto,
      urlCancelado,
      urlNotifica,
      ...(horasCaduca !== undefined ? { horasCaduca } : {}),
    });
  }

  async descargarDocumento(idDocumento: string): Promise<string> {
    const json: unknown = await peticion("descargar_documento", { idDocumento });
    if (typeof json === "string") return json;
    const base64 = leerCampo(json, ["documento", "archivoBase64", "documentoBase64", "pdfBase64", "base64"]);
    if (!base64) {
      throw new FirmaWebError("FirmaWeb no devolvió el PDF firmado en /descargar_documento.");
    }
    return base64;
  }
}