import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { Camera, Loader2 } from "lucide-react";
import { uploadConductorPhoto } from "@/features/conductor/services/conductorProfileService";

export function PhotoUploadCard() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "El archivo no es válido",
        description: "Sube una imagen (JPG, PNG, o similar).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "El archivo es muy pesado",
        description: "La imagen debe pesar menos de 4 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      await uploadConductorPhoto(user.id, file);
      await refreshProfile();
      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil se subió correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al subir foto",
        description: error instanceof Error ? error.message : "No fue posible subir la foto",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="stat-card">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <ConductorAvatar fullName={profile?.full_name} photoUrl={profile?.photo_url} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Tu foto de perfil</p>
          <p className="truncate text-xs text-muted-foreground">
            {profile?.photo_url
              ? "Esta es la foto que verán los demás."
              : "Sube una foto para aparecer en el dashboard."}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {profile?.photo_url ? "Cambiar" : "Subir"}
        </Button>
      </CardContent>
    </Card>
  );
}