/**
 * Reglas de fechas de vencimiento de documentos.
 *
 * Requerimiento:
 * Solo los siguientes 5 tipos de documentos requieren y deben mostrar fecha de vencimiento:
 * 1. Revisión Técnica
 * 2. Permiso de circulación
 * 3. SOAP
 * 4. PERMISO DE ASIENTO
 * 5. SEGURO CONDUCTOR
 *
 * Para todos los demás documentos (ej. boletas de compra de bencina, gastos varios, etc.),
 * la fecha de vencimiento NO debe solicitarse al subir ni mostrarse en las vistas.
 */

export const EXPIRATION_REQUIRED_TYPES = [
  "Revisión Técnica",
  "Permiso de circulación",
  "SOAP",
  "PERMISO DE ASIENTO",
  "SEGURO CONDUCTOR",
] as const;

export function normalizeDocTypeName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Determina si un tipo de documento requiere fecha de vencimiento.
 * Acepta el nombre del tipo o un objeto que contenga `name` o `requires_expiration`.
 */
export function requiresExpirationDate(
  docTypeOrName?: string | { name?: string | null; requires_expiration?: boolean | null } | null,
): boolean {
  if (!docTypeOrName) return false;

  if (typeof docTypeOrName === "object") {
    if (docTypeOrName.requires_expiration === true) {
      return true;
    }
    return requiresExpirationDate(docTypeOrName.name);
  }

  const normalized = normalizeDocTypeName(docTypeOrName);

  return (
    normalized.includes("revision tecnica") ||
    normalized.includes("permiso de circulacion") ||
    normalized === "soap" ||
    normalized.includes("soap") ||
    normalized.includes("permiso de asiento") ||
    normalized.includes("seguro conductor")
  );
}

