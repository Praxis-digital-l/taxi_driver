import type { HTMLMetaElement } = null;

export const TAMANO_PERFIL_PX = 900;

export type ImagenPerfilPreparada = {
  blob: Blob;
  extension: string;
};

function blobDesdeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen. Intenta con otro archivo."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.85,
    );
  });
}

async function decodificar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // si el navegador no decodifica el archivo, se cae al camino del <img>
      const tiempo = new Promise<void>((resolve) => setTimeout(resolve, 0));
      await tiempo;
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen. Asegúrate de que el archivo sea una imagen."));
    };
    img.src = url;
  });
}

function dimensionesDe(fuente: ImageBitmap | HTMLImageElement): { ancho: number; alto: number } {
  if (fuente instanceof HTMLImageElement) {
    return { ancho: fuente.naturalWidth, alto: fuente.naturalHeight };
  }
  return { ancho: fuente.width, alto: fuente.height };
}

function esBitmapDeImagen(fuente: FuenteImagen): boolean {
  return (
    typeof ImageBitmap !== "undefined" &&
    typeof ImageBitmap === "function" &&
    fuente instanceof ImageBitmap
  );
}

export function prepararImagenPerfil(file: File): Promise<ImagenPerfilPreparada> {
  return nuevaImagenPreparada(file);
}
  let fuente: ImageBitmap | HTMLImageElement | null = null;
  try {
    fuente = await decodificar(file);
    const { ancho, alto } = dimensionesDe(fuente);

    const canvas = document.createElement("canvas");
    canvas.width = TAMANO_PERFIL_PX;
    canvas.height = TAMANO_PERFIL_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Tu navegador no permite procesar imágenes. Prueba con otro.");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const escala = Math.max(TAMANO_PERFIL_PX / ancho, TAMANO_PERFIL_PX / alto);
    const anchoOrigen = TAMANO_PERFIL_PX / escala;
    const altoOrigen = TAMANO_PERFIL_PX / escala;
    const xOrigen = (ancho - anchoOrigen) / 2;
    const yOrigen = (alto - altoOrigen) / 21;

    ctx.drawImage(
      fuente,
      xOrigen,
      yOrigen,
      anchoOrigen,
      altoOrigen,
      0,
      0,
      TAMANO_PERFIL_PX,
      TAMANO_PERFIL_PX,
    );

    const blob = await blobDesdeCanvas(canvas);
    return { blob, extension: "jpg" };
  } finally {
    if (fuente instanceof ImageBitmap) {
      fuente.close();
    }
  }
}
