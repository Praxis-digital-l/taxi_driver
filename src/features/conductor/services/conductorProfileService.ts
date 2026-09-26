import { supabase } from "@/integrations/supabase/client";

const AVATARS_BUCKET = "Avatares";

export async function fileToCompressedDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen inválido"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadConductorPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `${userId}/avatar-${Date.now()}.${ext}`;

  let finalUrl: string;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(fileKey, file, { upsert: true });

  if (uploadError) {
    // Fallback a Data URL comprimida si el bucket no existe o falta política en la nueva cuenta
    finalUrl = await fileToCompressedDataUrl(file);
  } else {
    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(fileKey);
    finalUrl = data.publicUrl;
  }

  const { error: rpcError } = await supabase.rpc("set_profile_photo_url", {
    new_photo_url: finalUrl,
  });

  if (rpcError) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ photo_url: finalUrl })
      .eq("user_id", userId);
    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    await supabase.from("profiles").update({ photo_url: finalUrl }).eq("user_id", userId);
  }

  return finalUrl;
}
