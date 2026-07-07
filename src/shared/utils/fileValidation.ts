export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"] as const;

export const DOCUMENT_ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

const normalizeExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
};

export function isAllowedDocumentFile(file: File) {
  const mimeType = String(file.type || "").toLowerCase();
  const extension = normalizeExtension(file.name);

  const mimeAllowed = ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]);
  const extensionAllowed = ALLOWED_DOCUMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number]);

  if (mimeType.length === 0) {
    return extensionAllowed;
  }

  return mimeAllowed && extensionAllowed;
}
