/**
 * Controlador Orquestador del flujo de Liquidaciones de Nómina con FirmaWeb
 * Responsabilidades:
 * 1. Coordinar la generación del PDF con sus cuadrantes de firma
 * 2. Orquestar el ciclo de vida en FirmaWeb (crear proceso, agregar doc, agregar firmantes, iniciar)
 * 3. Atender el Webhook para descargar el PDF firmado y sobrescribir el archivo original
 */

import {
  DatosLiquidacionNomina,
  ResultadoInicioFlujoFirma,
  WebhookFirmaPayload,
  TipoFirma,
} from "../types/firmaweb.types";
import { IFirmaWebService, FirmaWebService } from "../services/FirmaWebService";
import { IPdfGeneratorService, PdfLiquidacionService } from "../services/PdfLiquidacionService";
import { IStorageService, LocalDiskStorageService } from "../services/StorageService";

export interface IControllerOptions {
  urlNotifica: string;
  urlCorrecto: string;
  urlCancelado: string;
  horasCaduca?: number;
}

export class LiquidacionFirmaController {
  /**
   * Registro en memoria o base de datos que asocia IdDocumento con la ruta del archivo local
   * Permite que el webhook identifique exactamente qué archivo sobrescribir.
   */
  private readonly documentRegistry = new Map<number, string>();

  constructor(
    private readonly firmaWebService: IFirmaWebService = new FirmaWebService(),
    private readonly pdfService: IPdfGeneratorService = new PdfLiquidacionService(),
    private readonly storageService: IStorageService = new LocalDiskStorageService(),
    private readonly options: IControllerOptions = {
      urlNotifica: process.env.FIRMAWEB_WEBHOOK_URL || "https://mi-servidor.cl/api/firmaweb/webhook",
      urlCorrecto: process.env.FIRMAWEB_REDIRECT_SUCCESS || "https://mi-servidor.cl/nomina/completado",
      urlCancelado: process.env.FIRMAWEB_REDIRECT_CANCEL || "https://mi-servidor.cl/nomina/cancelado",
      horasCaduca: 72,
    }
  ) {}

  // =========================================================================
  // PASO 1 Y 2: PREPARACIÓN DEL PDF Y CREACIÓN DEL FLUJO EN FIRMAWEB
  // =========================================================================

  /**
   * Orquesta la generación del PDF y su envío completo a FirmaWeb
   */
  public async iniciarFlujoFirmaLiquidacion(
    datos: DatosLiquidacionNomina
  ): Promise<ResultadoInicioFlujoFirma> {
    console.info(`[LiquidacionFirmaController] Iniciando flujo para: ${datos.empleado.nombre} (${datos.periodoMes})`);

    // 1. Generar el PDF con los recuadros de firma definidos
    const pdfResult = await this.pdfService.generarPdfLiquidacion(datos);

    // 2. Guardar la versión inicial (sin firmar) en el almacenamiento
    const rutaArchivoOriginal = `liquidaciones/${pdfResult.nombreArchivo}`;
    await this.storageService.guardarArchivo(rutaArchivoOriginal, pdfResult.base64);

    // 3. Crear proceso en FirmaWeb (hojaFinal: 0 para evitar insertar hojas adicionales)
    const proceso = await this.firmaWebService.crearProceso({
      nombre: `Liquidación - ${datos.empleado.nombre} ${datos.empleado.apellidoPaterno} - ${datos.periodoMes}`,
      notificar: 1,
      etiqueta: "NOMINA",
      geolocalizar: 1,
      hojaFinal: 0, // Requerido: evita hojas extra al final
    });

    console.info(`[LiquidacionFirmaController] Proceso #${proceso.IdProceso} creado (Grupo: ${proceso.IdGrupo})`);

    // 4. Agregar el documento PDF generado en Base64
    const docResponse = await this.firmaWebService.agregarDocumento({
      idProceso: proceso.IdProceso,
      idGrupo: proceso.IdGrupo,
      nombre: pdfResult.nombreArchivo,
      documento: pdfResult.base64,
    });

    // Registramos la relación IdDocumento -> ruta de almacenamiento para el Webhook
    this.documentRegistry.set(docResponse.IdDocumento, rutaArchivoOriginal);

    console.info(`[LiquidacionFirmaController] Documento #${docResponse.IdDocumento} vinculado`);

    // 5. Agregar Firmante 1: Empleador (Representante de Transportes El Montañez)
    const posEmpleador = pdfResult.posicionesFirma.empleador;
    await this.firmaWebService.agregarFirmante({
      idProceso: proceso.IdProceso,
      idGrupo: proceso.IdGrupo,
      nombre: datos.empleador.representanteNombre,
      apellidoPaterno: datos.empleador.representanteApellidoPaterno,
      apellidoMaterno: datos.empleador.representanteApellidoMaterno,
      rut: datos.empleador.representanteRut,
      email: datos.empleador.representanteEmail,
      tipoFirma: TipoFirma.FES, // Firma Electrónica Simple
      paginaFirma: posEmpleador.pagina,
      firmaPosX: posEmpleador.x,
      firmaPosY: posEmpleador.y,
    });

    // 6. Agregar Firmante 2: Empleado / Conductor
    const posEmpleado = pdfResult.posicionesFirma.empleado;
    await this.firmaWebService.agregarFirmante({
      idProceso: proceso.IdProceso,
      idGrupo: proceso.IdGrupo,
      nombre: datos.empleado.nombre,
      apellidoPaterno: datos.empleado.apellidoPaterno,
      apellidoMaterno: datos.empleado.apellidoMaterno,
      rut: datos.empleado.rut,
      email: datos.empleado.email,
      tipoFirma: TipoFirma.FES,
      paginaFirma: posEmpleado.pagina,
      firmaPosX: posEmpleado.x,
      firmaPosY: posEmpleado.y,
    });

    // 7. Iniciar el proceso y generar los links de firma
    const inicio = await this.firmaWebService.iniciarProceso({
      idProceso: proceso.IdProceso,
      urlCorrecto: this.options.urlCorrecto,
      urlCancelado: this.options.urlCancelado,
      urlNotifica: this.options.urlNotifica,
      horasCaduca: this.options.horasCaduca ?? 72,
    });

    console.info(`[LiquidacionFirmaController] Proceso iniciado con éxito con ${inicio.Firmantes.length} firmantes`);

    return {
      idProceso: proceso.IdProceso,
      idGrupo: proceso.IdGrupo,
      idDocumento: docResponse.IdDocumento,
      firmantes: inicio.Firmantes,
      urlNotifica: this.options.urlNotifica,
    };
  }

  // =========================================================================
  // PASO 3: RECEPTOR DEL WEBHOOK Y ACTUALIZACIÓN DEL ARCHIVO
  // =========================================================================

  /**
   * Procesa la notificación del Webhook de FirmaWeb (POST /webhook_test)
   * Si el documento fue firmado (Estado === 1), descarga el Base64 y sobrescribe el original.
   */
  public async procesarWebhookFirma(payload: WebhookFirmaPayload): Promise<{
    exito: boolean;
    mensaje: string;
    rutaArchivo?: string;
  }> {
    console.info(`[LiquidacionFirmaController] Recibido Webhook: Proceso #${payload.IdProceso}, Doc #${payload.IdDocumento}, Estado: ${payload.Estado}`);

    // Estado 1 indica completado / firmado con éxito
    if (payload.Estado !== 1) {
      return {
        exito: false,
        mensaje: `Documento #${payload.IdDocumento} aún en proceso o no completado (Estado: ${payload.Estado})`,
      };
    }

    // 1. Descargar documento firmado en Base64
    const docFirmado = await this.firmaWebService.descargarDocumento({
      idDocumento: payload.IdDocumento,
    });

    if (!docFirmado.Documento) {
      throw new Error(`FirmaWeb no retornó el Base64 del documento firmado #${payload.IdDocumento}`);
    }

    // 2. Determinar la ruta original del archivo a sobrescribir
    const rutaOriginal =
      this.documentRegistry.get(payload.IdDocumento) ||
      `liquidaciones/Liquidacion_Doc_${payload.IdDocumento}_firmada.pdf`;

    // 3. Sobrescribir el archivo en disco/almacenamiento
    await this.storageService.guardarArchivo(rutaOriginal, docFirmado.Documento);

    console.info(`[LiquidacionFirmaController] Archivo firmado sobrescrito exitosamente en: ${rutaOriginal}`);

    return {
      exito: true,
      mensaje: `Documento #${payload.IdDocumento} descargado y sobrescrito exitosamente.`,
      rutaArchivo: rutaOriginal,
    };
  }

  /**
   * Helper adaptador para Express / Node HTTP
   * Ejemplo de uso: router.post('/webhook', controller.crearHandlerHttpExpress());
   */
  public crearHandlerHttpExpress() {
    return async (
      req: { body: WebhookFirmaPayload },
      res: { status: (code: number) => { json: (data: unknown) => void } }
    ) => {
      try {
        const resultado = await this.procesarWebhookFirma(req.body);
        return res.status(200).json(resultado);
      } catch (err) {
        console.error("[Webhook Handler Error]", err);
        return res.status(500).json({
          exito: false,
          error: err instanceof Error ? err.message : "Error interno al procesar webhook",
        });
      }
    };
  }
}

