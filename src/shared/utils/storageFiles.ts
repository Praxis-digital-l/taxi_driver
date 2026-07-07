import { supabase } from "@/integrations/supabase/client";

const DOCUMENTS_BUCKET = "documents";

function getDefaultFileName(fileKey: string) {
  const segments = fileKey.split("/");
  return segments[segments.length - 1] || "archivo";
}

export async function createDocumentSignedUrl(fileKey: string, expiresInSeconds = 120) {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(fileKey, expiresInSeconds);

  if (error || data?.signedUrl === undefined) {
    throw new Error(error?.message || "No se pudo generar enlace de descarga");
  }

  return data.signedUrl;
}

export async function downloadDocumentFile(fileKey: string, fileName?: string) {
  const signedUrl = await createDocumentSignedUrl(fileKey);
  const link = document.createElement("a");
  link.href = signedUrl;
  link.download = fileName || getDefaultFileName(fileKey);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
