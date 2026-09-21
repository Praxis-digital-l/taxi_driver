import { subirFotoPerfil } from "@/features/profile/profileService";

export async function uploadConductorPhoto(userId: string, file: File): Promise<string> {
  return subirFotoPerfil(userId, file);
}