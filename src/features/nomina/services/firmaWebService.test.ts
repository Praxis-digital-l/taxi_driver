import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extraerUrlsFirma, FirmaWebService } from "./firmaWebService";
import { FirmaWebCredencialesError, FirmaWebError } from "./firmaWebAuthService";

const { invocarMock } = vi.hoisted(() => ({ invocarMock: vi.fn() }));

vi.mock("./firmaWebAuthService", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./firmaWebAuthService")>();
  return { ...original, invocarFirmaWeb: invocarMock };
});

describe("FirmaWebService", () => {
  beforeEach(() => {
    invocarMock.mockReset();
    invocarMock.mockResolvedValue({ Estado: 1 });
    FirmaWebService.resetearInstancia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    FirmaWebService.resetearInstancia();
  });

  it("crearProceso invoca crear_proceso con nombre/notificar/hojaFinal y mapea idProceso e idGrupo", async () => {
    invocarMock.mockResolvedValue({ Estado: 1, idProceso: 101, idGrupo: 202 });

    const proceso = await FirmaWebService.getInstance().crearProceso({
      nombre: "Liquidación Test",
      notificar: 2,
      hojaFinal: 1,
    });

    expect(proceso).toEqual({ IdProceso: "101", IdGrupo: "202" });
    expect(invocarMock).toHaveBeenCalledWith("crear_proceso", {
      nombre: "Liquidación Test",
      notificar: 2,
      hojaFinal: 1,
    });
  });

  it("agregarDocumento envía el PDF Base64 en el campo documento", async () => {
    invocarMock.mockResolvedValue({ Estado: 1, idDocumento: 7 });

    const doc = await FirmaWebService.getInstance().agregarDocumento(
      "101",
      "202",
      "JVBERi0xLjc=",
      "liquidacion-01.pdf",
    );

    expect(doc).toEqual({ IdDocumento: "7" });
    expect(invocarMock).toHaveBeenCalledWith("agregar_documento", {
      idProceso: "101",
      idGrupo: "202",
      nombre: "liquidacion-01.pdf",
      documento: "JVBERi0xLjc=",
    });
  });

  it("agregarFirmante envía los datos con tipoFirma 2 (FES simple)", async () => {
    await FirmaWebService.getInstance().agregarFirmante("101", "202", {
      nombre: "Juan",
      apellidoPaterno: "Pérez",
      apellidoMaterno: "Gómez",
      rut: "11111111-1",
      email: "trabajador@example.cl",
      tipoFirma: 2,
    });

    expect(invocarMock).toHaveBeenCalledWith("agregar_firmante", {
      idProceso: "101",
      idGrupo: "202",
      nombre: "Juan",
      apellidoPaterno: "Pérez",
      apellidoMaterno: "Gómez",
      rut: "11111111-1",
      email: "trabajador@example.cl",
      tipoFirma: 2,
    });
  });

  it("iniciarProceso envía idProceso y las tres URLs", async () => {
    await FirmaWebService.getInstance().iniciarProceso(
      "101",
      "https://app.cl/firma/exito",
      "https://app.cl/firma/cancelado",
      "https://api.app.cl/webhooks/firmaweb",
      72,
    );

    expect(invocarMock).toHaveBeenCalledWith("iniciar_proceso", {
      idProceso: "101",
      urlCorrecto: "https://app.cl/firma/exito",
      urlCancelado: "https://app.cl/firma/cancelado",
      urlNotifica: "https://api.app.cl/webhooks/firmaweb",
      horasCaduca: 72,
    });
  });

  it("descargarDocumento lee el PDF firmado del campo documento", async () => {
    invocarMock.mockResolvedValue({ Estado: 1, documento: "JVBERi1maXJtYWRv" });

    const base64 = await FirmaWebService.getInstance().descargarDocumento("7");

    expect(base64).toBe("JVBERi1maXJtYWRv");
    expect(invocarMock).toHaveBeenCalledWith("descargar_documento", { idDocumento: "7" });
  });

  it("lanza FirmaWebCredencialesError cuando Estado es 93", async () => {
    invocarMock.mockResolvedValue({ Estado: 93, mensaje: "credenciales invalidas" });

    const error = await FirmaWebService.getInstance()
      .crearProceso({ nombre: "x", notificar: 2, hojaFinal: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebCredencialesError);
    expect((error as Error).message).toContain("401");
  });

  it("lanza FirmaWebError con el mensaje cuando Estado es 99 (datos inválidos)", async () => {
    invocarMock.mockResolvedValue({ Estado: 99, mensaje: "rut mal formado" });

    const error = await FirmaWebService.getInstance()
      .crearProceso({ nombre: "x", notificar: 2, hojaFinal: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebError);
    expect((error as Error).message).toContain("Datos inválidos");
  });

  it("lanza FirmaWebError cuando falta idProceso/idGrupo en la respuesta", async () => {
    invocarMock.mockResolvedValue({ Estado: 1 });

    const error = await FirmaWebService.getInstance()
      .crearProceso({ nombre: "x", notificar: 2, hojaFinal: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebError);
    expect((error as Error).message).toContain("idProceso");
  });
});

describe("extraerUrlsFirma", () => {
  it("lee un arreglo de firmantes con urlFirma/email/rut", () => {
    const urls = extraerUrlsFirma({
      Estado: 1,
      firmantes: [
        { urlFirma: "https://fw.cl/f/1", email: "admin@cl", rut: "11.111.111-1" },
        { urlFirma: "https://fw.cl/f/2", email: "trabajador@cl", rut: "22.222.222-2" },
      ],
    });

    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatchObject({ url: "https://fw.cl/f/1", email: "admin@cl" });
    expect(urls[1].rut).toBe("22.222.222-2");
  });

  it("acepta nombres alternativos (urlsFirma, firmaUrl, link) a nivel raíz", () => {
    expect(extraerUrlsFirma({ Estado: 1, urlsFirma: ["https://fw.cl/a", "https://fw.cl/b"] })).toEqual([
      { url: "https://fw.cl/a" },
      { url: "https://fw.cl/b" },
    ]);
    expect(extraerUrlsFirma({ Estado: 1, firmaUrl: "https://fw.cl/u" })).toEqual([{ url: "https://fw.cl/u" }]);
    expect(extraerUrlsFirma({ Estado: 1, link: "https://fw.cl/l" })).toEqual([{ url: "https://fw.cl/l" }]);
  });

  it("busca en el primer objeto anidado si no hay URLs a nivel raíz", () => {
    const urls = extraerUrlsFirma({ Estado: 1, data: { firmantes: [{ url: "https://fw.cl/x" }] } });
    expect(urls).toEqual([{ url: "https://fw.cl/x" }]);
  });

  it("retorna [] cuando no encuentra URLs", () => {
    expect(extraerUrlsFirma({ Estado: 1, mensaje: "ok" })).toEqual([]);
    expect(extraerUrlsFirma("no-es-objeto")).toEqual([]);
  });
});