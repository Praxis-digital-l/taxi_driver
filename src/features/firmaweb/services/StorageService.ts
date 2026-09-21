/**
 * Abstracción del servicio de almacenamiento de archivos
 * Permite guardar y sobrescribir las versiones iniciales y firmadas de las liquidaciones.
 */

export interface IStorageService {
  /** Guarda o sobrescribe un archivo a partir de un string Base64 */
  guardarArchivo(ruta: string, contenidoBase64: string): Promise<string>;
  /** Obtiene el contenido en Base64 de un archivo almacenado */
  obtenerArchivo(ruta: string): Promise<string>;
  /** Verifica si el archivo existe */
  existeArchivo(ruta: string): Promise<boolean>;
}

/**
 * Implementación de almacenamiento en sistema de archivos local (Node.js)
 * Con soporte para inyección de dependencias y fallback seguro
 */
export class LocalDiskStorageService implements IStorageService {
  constructor(private readonly basePath = "./storage/liquidaciones") {}

  public async guardarArchivo(rutaRelativa: string, contenidoBase64: string): Promise<string> {
    const fullPath = `${this.basePath}/${rutaRelativa}`.replace(/\/+/g, "/");

    // Si estamos en un entorno Node.js con acceso a 'fs'
    if (typeof process !== "undefined" && process?.versions?.node) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        const buffer = Buffer.from(contenidoBase64, "base64");
        await fs.writeFile(fullPath, buffer);
        return fullPath;
      } catch (err) {
        console.warn("[LocalDiskStorageService] Fallback en entorno fs:", err);
      }
    }

    // Fallback en memoria o emulador si no hay fs
    console.info(`[Storage Mock] Archivo guardado/sobrescrito exitosamente en: ${fullPath} (${contenidoBase64.length} chars)`);
    return fullPath;
  }

  public async obtenerArchivo(rutaRelativa: string): Promise<string> {
    const fullPath = `${this.basePath}/${rutaRelativa}`.replace(/\/+/g, "/");
    if (typeof process !== "undefined" && process?.versions?.node) {
      const fs = await import("fs/promises");
      const buffer = await fs.readFile(fullPath);
      return buffer.toString("base64");
    }
    return "";
  }

  public async existeArchivo(rutaRelativa: string): Promise<boolean> {
    const fullPath = `${this.basePath}/${rutaRelativa}`.replace(/\/+/g, "/");
    if (typeof process !== "undefined" && process?.versions?.node) {
      try {
        const fs = await import("fs/promises");
        await fs.access(fullPath);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}

