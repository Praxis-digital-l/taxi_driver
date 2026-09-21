import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FirmaWebCredencialesError,
  FirmaWebError,
  invocarFirmaWeb,
  leerCampo,
} from "./firmaWebAuthService";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
  },
}));

describe("invocarFirmaWeb", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.stubEnv("VITE_USE_MOCK_SUPABASE", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("invoca la Edge Function firmaweb con { operacion, cuerpo } y devuelve data", async () => {
    invokeMock.mockResolvedValue({
      data: { Estado: 1, idDocumento: 7 },
      error: null,
    });

    const resultado = await invocarFirmaWeb("agregar_documento", { idProceso: "1", documento: "pdf" });

    expect(resultado).toEqual({ Estado: 1, idDocumento: 7 });
    expect(invokeMock).toHaveBeenCalledWith("firmaweb", {
      body: { operacion: "agregar_documento", cuerpo: { idProceso: "1", documento: "pdf" } },
    });
  });

  it("lanza FirmaWebCredencialesError cuando la función responde 401", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "HTTP 401", context: { status: 401 } },
    });

    const error = await invocarFirmaWeb("crear_proceso", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebCredencialesError);
    expect(error).toBeInstanceOf(FirmaWebError);
    expect((error as FirmaWebError).status).toBe(401);
    expect((error as Error).message).toContain("401");
  });

  it("lanza FirmaWebError con status 429 por límite de solicitudes", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "HTTP 429", context: { status: 429 } },
    });

    const error = await invocarFirmaWeb("crear_proceso", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebError);
    expect((error as FirmaWebError).status).toBe(429);
    expect((error as Error).message).toContain("429");
  });

  it("lanza FirmaWebError con el status para otros errores HTTP", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "HTTP 500", context: { status: 500 } },
    });

    const error = await invocarFirmaWeb("credificio", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebError);
    expect((error as FirmaWebError).status).toBe(500);
  });

  it("lanza FirmaWebError cuando no está disponible en modo mock", async () => {
    vi.stubEnv("VITE_USE_MOCK_SUPABASE", "true");

    const error = await invocarFirmaWeb("crear_proceso", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FirmaWebError);
    expect((error as Error).message).toContain("mock");
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe("leerCampo", () => {
  it("lee valores string con el primer nombre que exista", () => {
    expect(leerCampo({ a: "x", b: "y" }, ["zz", "a", "b"])).toBe("x");
  });

  it("convierte números a string y omite vacíos", () => {
    expect(leerCampo({ id: 42 }, ["id"])).toBe("42");
    expect(leerCampo({ id: "" }, ["id"])).toBeUndefined();
    expect(leerCampo(null, ["id"])).toBeUndefined();
  });
});