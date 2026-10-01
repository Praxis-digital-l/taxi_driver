import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirmaWebService } from "../services/FirmaWebService";
import { FirmaWebRateLimitError, FirmaWebInsufficientSignaturesError, FirmaWebAuthError } from "../errors/firmaweb.errors";
import { PdfLiquidacionService } from "../services/PdfLiquidacionService";
import { LiquidacionFirmaController } from "../controllers/LiquidacionFirmaController";
import { IStorageService } from "../services/StorageService";

describe("FirmaWebService", () => {
  const mockConfig = {
    baseUrl: "https://testing.firmaweb.app/apifw/v1",
    user: "testuser",
    password: "testpassword",
    authBase64: "dGVzdHVzZXI6dGVzdHBhc3N3b3Jk",
    timeoutMs: 5000,
    maxRetries: 2,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe autenticarse y almacenar el token en memoria", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        Estado: 1,
        Mensaje: "Correcto",
        Token: "mock_jwt_token_123",
        Token_tipo: "Bearer",
        Expira_en: Math.floor(Date.now() / 1000) + 900,
      }),
    });

    const service = new FirmaWebService(mockConfig, mockFetch as unknown as typeof fetch);
    const token = await service.getValidToken();

    expect(token).toBe("mock_jwt_token_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Segunda llamada debe usar la memoria sin invocar fetch
    const cachedToken = await service.getValidToken();
    expect(cachedToken).toBe("mock_jwt_token_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("debe lanzar FirmaWebAuthError ante HTTP 401 o Estado 93", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({
        Estado: 93,
        Mensaje: "No autorizado",
      }),
    });

    const service = new FirmaWebService(mockConfig, mockFetch as unknown as typeof fetch);
    await expect(service.obtenerToken()).rejects.toThrow(FirmaWebAuthError);
  });

  it("debe lanzar FirmaWebInsufficientSignaturesError si Estado es 97", async () => {
    const mockFetch = vi
      .fn()
      // 1. /token
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          Estado: 1,
          Mensaje: "Correcto",
          Token: "valid_token",
          Token_tipo: "Bearer",
          Expira_en: Math.floor(Date.now() / 1000) + 900,
        }),
      })
      // 2. /crear_proceso
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          Estado: 97,
          Mensaje: "No tiene firmas disponibles",
        }),
      });

    const service = new FirmaWebService(mockConfig, mockFetch as unknown as typeof fetch);
    await expect(
      service.crearProceso({
        nombre: "Test",
        notificar: 1,
        hojaFinal: 0,
      })
    ).rejects.toThrow(FirmaWebInsufficientSignaturesError);
  });

  it("debe respetar Rate Limit 429 y reintentar con backoff", async () => {
    const mockFetch = vi
      .fn()
      // Primer intento: 429
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "1" }),
        json: async () => ({ Estado: 429, Mensaje: "Demasiados intentos..." }),
      })
      // Segundo intento: 200 Exitoso
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          Estado: 1,
          Mensaje: "Correcto",
          Token: "token_after_retry",
          Token_tipo: "Bearer",
          Expira_en: Math.floor(Date.now() / 1000) + 900,
        }),
      });

    const service = new FirmaWebService(mockConfig, mockFetch as unknown as typeof fetch);
    const res = await service.obtenerToken();

    expect(res.Token).toBe("token_after_retry");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("PdfLiquidacionService", () => {
  it("debe generar un PDF en Base64 con las posiciones de firma para empleador y empleado", async () => {
    const pdfService = new PdfLiquidacionService();
    const resultado = await pdfService.generarPdfLiquidacion({
      periodoMes: "Septiembre 2026",
      fechaEmision: "21 de Septiembre 2026",
      empleador: {
        razonSocial: "Transportes El Montañez SpA",
        rut: "77.611.481-2",
        representanteNombre: "Carlos",
        representanteApellidoPaterno: "González",
        representanteRut: "11.111.111-1",
        representanteEmail: "carlos@elmontanez.cl",
      },
      empleado: {
        nombre: "Juan",
        apellidoPaterno: "Pérez",
        rut: "18.888.888-8",
        email: "juan.perez@example.com",
        trabajadorId: "COND-042",
      },
      totalFacturado: 1500000,
      descuentosPrimarios: [{ concepto: "Cuota de Arriendo", monto: 300000 }],
      totalDescuentos: 300000,
      totalAPagar: 1200000,
    });

    expect(resultado.base64).toBeTruthy();
    expect(resultado.nombreArchivo).toContain("COND-042");
    expect(resultado.posicionesFirma.empleador.pagina).toBe(1);
    expect(resultado.posicionesFirma.empleado.pagina).toBe(1);
    expect(resultado.posicionesFirma.empleador.x).toBeLessThan(resultado.posicionesFirma.empleado.x);
  });
});

describe("LiquidacionFirmaController", () => {
  it("debe orquestar el flujo completo y recibir el webhook para sobrescribir", async () => {
    const mockFirmaService = {
      obtenerToken: vi.fn(),
      crearProceso: vi.fn().mockResolvedValue({
        IdProceso: 95,
        IdGrupo: 96,
        Estado: 1,
        Mensaje: "Proceso creado",
      }),
      agregarDocumento: vi.fn().mockResolvedValue({
        IdDocumento: 87,
        Estado: 1,
        Mensaje: "Documento cargado",
      }),
      agregarFirmante: vi.fn().mockResolvedValue({
        Estado: 1,
        Mensaje: "Firmante creado",
      }),
      iniciarProceso: vi.fn().mockResolvedValue({
        Estado: 1,
        Mensaje: "Proceso iniciado",
        Firmantes: [
          { Email: "carlos@elmontanez.cl", Url: "https://firmaweb.app/sign/1", Notificado: "1" },
          { Email: "juan.perez@example.com", Url: "https://firmaweb.app/sign/2", Notificado: "1" },
        ],
      }),
      descargarDocumento: vi.fn().mockResolvedValue({
        Estado: 1,
        Mensaje: "Correcto",
        Documento: "BASE64_PDF_FIRMADO_FINAL",
      }),
      consultarSaldos: vi.fn(),
      notificarMovil: vi.fn(),
    };

    const savedFiles = new Map<string, string>();
    const mockStorage: IStorageService = {
      guardarArchivo: vi.fn(async (path, content) => {
        savedFiles.set(path, content);
        return path;
      }),
      obtenerArchivo: vi.fn(async (path) => savedFiles.get(path) || ""),
      existeArchivo: vi.fn(async (path) => savedFiles.has(path)),
    };

    const controller = new LiquidacionFirmaController(
      mockFirmaService as any,
      new PdfLiquidacionService(),
      mockStorage
    );

    // 1. Iniciar flujo
    const resultadoInicio = await controller.iniciarFlujoFirmaLiquidacion({
      periodoMes: "Septiembre 2026",
      fechaEmision: "21-09-2026",
      empleador: {
        razonSocial: "Transportes El Montañez",
        rut: "77.611.481-2",
        representanteNombre: "Carlos",
        representanteApellidoPaterno: "González",
        representanteRut: "11.111.111-1",
        representanteEmail: "carlos@elmontanez.cl",
      },
      empleado: {
        nombre: "Juan",
        apellidoPaterno: "Pérez",
        rut: "18.888.888-8",
        email: "juan.perez@example.com",
        trabajadorId: "COND-042",
      },
      totalFacturado: 1000000,
      descuentosPrimarios: [{ concepto: "Gasto Operacional", monto: 200000 }],
      totalDescuentos: 200000,
      totalAPagar: 800000,
    });

    expect(resultadoInicio.idProceso).toBe(95);
    expect(resultadoInicio.idDocumento).toBe(87);
    expect(mockFirmaService.crearProceso).toHaveBeenCalledWith(
      expect.objectContaining({ hojaFinal: 0 })
    );
    expect(mockFirmaService.agregarFirmante).toHaveBeenCalledTimes(2);

    // 2. Simular Webhook recibido cuando el documento está firmado (Estado: 1)
    const resWebhook = await controller.procesarWebhookFirma({
      IdProceso: 95,
      IdDocumento: 87,
      Estado: 1,
    });

    expect(resWebhook.exito).toBe(true);
    expect(mockFirmaService.descargarDocumento).toHaveBeenCalledWith({ idDocumento: 87 });
    expect(mockStorage.guardarArchivo).toHaveBeenCalledWith(
      expect.stringContaining("COND-042"),
      "BASE64_PDF_FIRMADO_FINAL"
    );
  });
});

