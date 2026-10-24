import { supabase } from "@/integrations/supabase/client";

export type AdminDocument = {
  id: string;
  description: string | null;
  file_url: string;
  file_key: string;
  expiration_date: string | null;
  created_at: string;
  amount?: number | null;
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
    .select("id, description, file_url, file_key, expiration_date, created_at, amount, document_types(name), profiles(full_name), vehicles(license_plate)")
    .order("created_at", { ascending: false });

  assertNoError(error);
  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
  })) as AdminDocument[];
}

export async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select("id, name")
    .order("name", { ascending: true });

  assertNoError(error);
  return (data ?? []) as DocumentType[];
}
