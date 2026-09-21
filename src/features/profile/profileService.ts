import { supabase } from "@/integrations/supabase/client";
import { prepararImagenPerfil } from "@/shared/utils/prepararImagenPerfil";

const AVATARS_BUCKET = "Avatares";

export type DatosPerfilEditables = {
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  rut: string;
  phone: string;
};

export async function actualizarMiPerfil(datos: DatosPerfilEditables): Promise<void> {
  const { error } = await supabase.rpc("update_own_profile", {
    p_nombres: datos.nombres.trim(),
    p_apellido_paterno: datos.apellido_paterno.trim(),
    p_apellido_materno: datos.apellido_materno.trim(),
    p_rut: datos.rut.trim(),
    p_phone: datos.phone.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function subirFotoPerfil(userId: string, file: File): Promise<string> {
  const preparada = await prepararImagenPerfil(file);
  const fileKey = `${userId}/avatar-${Date.now()}.${preparada.extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(fileKey, preparada.blob, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(fileKey);

  const { error: rpcError } = await supabase.rpc("set_profile_photo_url", {
    new_photo_url: data.publicUrl,
  });
  if (rpcError) throw new Error(rpcError.message);

  return data.publicUrl;
}