import { supabase } from "@/integrations/supabase/client";

export type AdminDocument = {
  id: string;
  status: string;
  description: string | null;
  file_url: string;
  file_key: string;
  expiration_date: string | null;
  created_at: string;
  document_types?: { name: string | null } | null;
  profiles?: { full_name: string | null } | null;
  vehicles?: { license_plate: string | null } | null;
};

export type DocumentType = {
  id: string;
  name: string;
};

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAllDocuments(): Promise<AdminDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, status, description, file_url, file_key, expiration_date, created_at, document_types(name), profiles(full_name), vehicles(license_plate)")
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as AdminDocument[];
}

export async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select("id, name")
    .order("name", { ascending: true });

  assertNoError(error);
  return (data ?? []) as DocumentType[];
}
