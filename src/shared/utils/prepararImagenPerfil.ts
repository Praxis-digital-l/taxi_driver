export const TAMANO_PERFIL_PX = 900;

export type ImagenPerfilPreparada = {
  blob: Blob;
  extension: string;
};

type FuenteImagen = ImageBitmap | HTMLImageElement;

export function prepararImagenPerfil(file: File): Promise<ImagenPerfilPreparada> {
  return nuevaImagenPreparada(file);
}

async function decodificar(file: File): Promise<FuenteImagen> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // el navegador no decodificó el archivo como bitmap; caemos al camino del <img>
    }
  }
  return new Promise<FuenteImagen>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen. Asegúrate de que sea un archivo de imagen."));
    };
    img.src = url;
  });
}

function dimensionesDe(fuente: FuenteImagen): { ancho: number; alto: number } {
  if (fuente instanceof HTMLImageElement) {
    return { ancho: fuente.naturalWidth, alto: fuente.naturalHeight };
  }
  return { ancho: fuente.width, alto: fuente.height };
}

function esBitmap(fuente: FuenteImagen): boolean {
  return typeof ImageBitmap === "function" && fuente instanceof ImageBitmap;
}

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

async function nuevaImagenPreparada(file: File): Promise<ImagenPerfilPreparada> {
  let fuente: FuenteImagen | null = null;
  try {
    fuente = await decodificar(file);
    const { ancho, alto } = dimensionesDe(fuente-ra);
    if (ancho <= 0 || alto <= 0) {
      throw new Error("El archivo no tiene información de imagen válida.");
    }

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
    const yOrigen = (alto - altoOrigen) / 2;

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
    if (fuente && esBitmap(fuente)) {
      fuente.close();
    }
  }
}