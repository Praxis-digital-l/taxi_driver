/**
 * Tipos e interfaces estrictas para la API REST de FirmaWeb
 * Especificación oficial DEV/PROD
 */

// ==========================================
// 1. Configuración del Servicio
// ==========================================

export type FirmaWebEnvironment = "dev" | "prod" | "custom";

export interface IFirmaWebConfig {
  /** Entorno de ejecución: 'dev' (testing) o 'prod' (sistema) */
  environment?: FirmaWebEnvironment;
  /** URL Base personalizada (si environment es 'custom') */
  baseUrl?: string;
  /** Usuario para autenticación FirmaWeb */
  user?: string;
  /** Contraseña para autenticación FirmaWeb */
  password?: string;
  /** Header de autenticación pre-codificado en Base64 (usuario:clave) */
  authBase64?: string;
  /** Tiempo de espera de red en milisegundos (default: 15000) */
  timeoutMs?: number;
  /** Número máximo de reintentos ante HTTP 429 (default: 3) */
  maxRetries?: number;
}

// ==========================================
// 2. Interfaces de Autenticación (/token)
// ==========================================

export interface FirmaWebTokenSuccessResponse {
  Estado: 1;
  Mensaje: string; // e.g. "Correcto"
  Token: string;
  Token_tipo: "Bearer";
  /** Timestamp Unix en segundos en que expira el token (15 min) */
  Expira_en: number;
}

export interface FirmaWebTokenError401Response {
  Estado: 93;
  Mensaje: string; // "No autorizado"
}

export interface FirmaWebTokenError429Response {
  Estado: 429;
  Mensaje: string; // "Demasiados intentos..."
}

export type FirmaWebTokenResponse =
  | FirmaWebTokenSuccessResponse
  | FirmaWebTokenError401Response
  | FirmaWebTokenError429Response;

// ==========================================
// 3. Crear Proceso (/crear_proceso)
// ==========================================

export interface CrearProcesoRequest {
  nombre: string;
  /** 1: Sí notificar, 0: No notificar */
  notificar: number;
  etiqueta?: string;
  geolocalizar?: number;
  /** 0: No agregar hoja final de firmas, 1: Agregar hoja final */
  hojaFinal: number;
}

export interface CrearProcesoSuccessResponse {
  IdProceso: number;
  IdGrupo: number;
  Estado: 1;
  Mensaje: string; // "Proceso creado"
}

export interface CrearProcesoWarningResponse {
  Estado: 97;
  Mensaje: string; // "No tiene firmas disponibles"
}

export type CrearProcesoResponse =
  | CrearProcesoSuccessResponse
  | CrearProcesoWarningResponse;

// ==========================================
// 4. Agregar Documento (/agregar_documento)
// ==========================================

export interface AgregarDocumentoRequest {
  idProceso: number;
  idGrupo: number;
  nombre: string;
  /** Archivo PDF codificado en Base64 */
  documento: string;
}

export interface AgregarDocumentoResponse {
  IdDocumento: number;
  Estado: 1 | number;
  Mensaje: string; // "Documento cargado"
}

// ==========================================
// 5. Agregar Firmante (/agregar_firmante)
// ==========================================

export enum TipoFirma {
  /** Firma Avanzada Online (FAO) */
  FAO = 1,
  /** Firma Electrónica Simple / Estándar (FES) */
  FES = 2,
}

export interface AgregarFirmanteRequest {
  idProceso: number;
  idGrupo: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  /** RUT chileno con formato 12345678-9 */
  rut: string;
  email: string;
  tipoFirma: TipoFirma | number;
  /** Número de página donde se estampará la firma (1-indexed) */
  paginaFirma?: number;
  /** Coordenada X para la estampa de firma */
  firmaPosX?: number;
  /** Coordenada Y para la estampa de firma */
  firmaPosY?: number;
}

export interface AgregarFirmanteResponse {
  Estado: 1 | number;
  Mensaje: string; // "Firmante creado"
}

// ==========================================
// 6. Iniciar Proceso (/iniciar_proceso)
// ==========================================

export interface IniciarProcesoRequest {
  idProceso: number;
  urlCorrecto: string;
  urlCancelado: string;
  urlNotifica: string;
  horasCaduca?: number;
}

export interface FirmanteDetalleProceso {
  Email: string;
  Url: string;
  Notificado: string;
}

export interface IniciarProcesoResponse {
  Estado: 1 | number;
  Mensaje: string; // "Proceso iniciado"
  Firmantes: FirmanteDetalleProceso[];
}

// ==========================================
// 7. Descargar Documento (/descargar_documento)
// ==========================================

export interface DescargarDocumentoRequest {
  idDocumento: number;
}

export interface DescargarDocumentoResponse {
  Estado: 1 | number;
  Mensaje: string; // "Correcto"
  /** Archivo PDF firmado codificado en Base64 */
  Documento: string;
}

// ==========================================
// 8. Consultar Saldos (/consultar_saldos)
// ==========================================

export interface ConsultarSaldosResponse {
  fes_disponibles: number;
  fao_disponibles: number;
  Estado: 1 | number;
  Mensaje: string; // "Correcto"
}

// ==========================================
// 9. Notificar Móvil (/notificar_movil)
// ==========================================

export interface NotificarMovilRequest {
  idProceso: number;
  Email: string;
}

export interface NotificarMovilResponse {
  Estado: 1 | number;
  Mensaje: string;
}

// ==========================================
// 10. Webhook Receptor (POST /webhook_test)
// ==========================================

export interface WebhookFirmaPayload {
  IdProceso: number;
  IdDocumento: number;
  /** 1: Completado exitosamente / Firmado */
  Estado: number;
}

// ==========================================
// 11. Tipos de Dominio de Negocio: Liquidación
// ==========================================

export interface DatosEmpleadoLiquidacion {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  rut: string;
  email: string;
  trabajadorId: string;
}

export interface DatosEmpleadorLiquidacion {
  razonSocial: string;
  rut: string;
  representanteNombre: string;
  representanteApellidoPaterno: string;
  representanteApellidoMaterno?: string;
  representanteRut: string;
  representanteEmail: string;
}

export interface DetalleConceptoNomina {
  concepto: string;
  monto: number;
}

export interface DatosLiquidacionNomina {
  idLiquidacion?: string;
  periodoMes: string;
  fechaEmision: string;
  empleador: DatosEmpleadorLiquidacion;
  empleado: DatosEmpleadoLiquidacion;
  totalFacturado: number;
  descuentosPrimarios: DetalleConceptoNomina[];
  descuentosSecundarios?: DetalleConceptoNomina[];
  totalDescuentos: number;
  totalAPagar: number;
}

export interface CoordenadasFirma {
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface UbicacionesFirmaLiquidacion {
  empleador: CoordenadasFirma;
  empleado: CoordenadasFirma;
}

export interface ResultadoGeneracionPdf {
  base64: string;
  nombreArchivo: string;
  totalPaginas: number;
  posicionesFirma: UbicacionesFirmaLiquidacion;
}

export interface ResultadoInicioFlujoFirma {
  idProceso: number;
  idGrupo: number;
  idDocumento: number;
  firmantes: FirmanteDetalleProceso[];
  urlNotifica: string;
}

