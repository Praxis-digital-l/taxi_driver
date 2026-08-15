import { supabase } from "@/integrations/supabase/client";

const AVATARS_BUCKET = "Avatares";

export async function uploadConductorPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(fileKey, file, { upsert: true });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(fileKey);

  const { error: rpcError } = await supabase.rpc("set_profile_photo_url", {
    new_photo_url: data.publicUrl,
  });
  if (rpcError) {
    throw new Error(rpcError.message);
  }

  return data.publicUrl;
}