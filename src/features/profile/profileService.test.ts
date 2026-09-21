import { afterEach, describe, expect, it, vi } from "vitest";
import { actualizarMiPerfil, subirFotoPerfil } from "./profileService";

const { rpcMock, uploadMock, publicUrlMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  uploadMock: vi.fn(),
  publicUrlMock: vi.fn(),
}));

const { prepararMock } = vi.hoisted(() => ({
  prepararMock: vi.fn(),
}));

vi.mock("@/shared/utils/prepararImagenPerfil", () => ({
  prepararImagenPerfil: prepararMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: publicUrlMock,
      }),
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("actualizarMiPerfil", () => {
  it("llama el RPC update_own_profile con los campos recortados", async () => {
    rpcMock.mockResolvedValue({ error: null });

    await actualizarMiPerfil({
      nombres: "  Juan  ",
      apellido_paterno: "  Pérez  ",
      apellido_materno: "  Soto  ",
      rut: " 11111111-1 ",
      phone: " +56 9 1234 5678 ",
    });

    expect(rpcMock).toHaveBeenCalledWith("update_own_profile", {
      p_nombres: "Juan",
      p_apellido_paterno: "Pérez",
      p_apellido_materno: "Soto",
      p_rut: "11111111-1",
      p_phone: "+56 9 1234 5678",
    });
  });

  it("lanza Error cuando el RPC devuelve un error", async () => {
    rpcMock.mockResolvedValue({ error: { message: "viola restricción de unicidad" } });

    const error = await actualizarMiPerfil({
      nombres: "Juan",
      apellido_paterno: "Pérez",
      apellido_materno: "Soto",
      rut: "11111111-1",
      phone: "",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("unicidad");
  });
});

describe("subirFotoPerfil", () => {
  it("preprocesa la imagen a jpg estándar y la sube al bucket Avatares", async () => {
    const original = new File(["x"], "foto.png", { type: "image/png" });
    const preparada = new File(["y"], "preparada", { type: "image/jpeg" });
    prepararMock.mockResolvedValue({ blob: preparada, extension: "jpg" });

    uploadMock.mockResolvedValue({ error: null });
    publicUrlMock.mockReturnValue({ data: { publicUrl: "https://x/avatar.jpg" } });
    const rpc = rpcMock.mockResolvedValue({ error: null });

    const url = await subirFotoPerfil("user-1", original);

    expect(url).toBe("https://x/avatar.jpg");
    expect(prepararMock).toHaveBeenCalledWith(original);
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/avatar-\d+\.jpg$/),
      preparada,
      { upsert: true },
    );
    expect(rpc).toHaveBeenCalledWith("set_profile_photo_url", {
      new_photo_url: "https://x/avatar.jpg",
    });
  });

  it("lanza Error si falla la subida al storage", async () => {
    const original = new File(["x"], "foto.png", { type: "image/png" });
    prepararMock.mockResolvedValue({ blob: new File(["y"], "p", { type: "image/jpeg" }), extension: "jpg" });
    uploadMock.mockResolvedValue({ error: { message: "no autorizado" } });

    const error = await subirFotoPerfil("user-1", original).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("no autorizado");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
