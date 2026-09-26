import { useRef, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { Camera, Loader2, User, Truck, Star, UserCog } from "lucide-react";
import { uploadConductorPhoto } from "@/features/conductor/services/conductorProfileService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PhotoUploadCardProps {
  className?: string;
}

export function PhotoUploadCard({ className }: PhotoUploadCardProps) {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [assignedPlate, setAssignedPlate] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const fetchVehicle = async () => {
      try {
        const { data } = await supabase
          .from("vehicle_assignments")
          .select("vehicles(license_plate)")
          .eq("profile_id", profile.id)
          .limit(1)
          .maybeSingle();

        if (active && data?.vehicles) {
          const v = data.vehicles as unknown as { license_plate: string };
          setAssignedPlate(v.license_plate);
        }
      } catch (err) {
        console.warn("No se pudo cargar patente asignada:", err);
      }
    };
    fetchVehicle();
    return () => {
      active = false;
    };
  }, [profile]);

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

  const fullName =
    profile?.full_name ||
    [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno]
      .filter(Boolean)
      .join(" ") ||
    "Conductor";

  const workerCode = profile?.worker_id;
  const rut = profile?.rut;
  const score = profile?.score;

  return (
    <>
      <Card
        className={cn(
          "relative overflow-hidden border border-border/80 shadow-sm bg-card hover:shadow-md transition-all flex flex-col justify-between",
          className
        )}
      >
        {/* Decorative ambient gradient */}
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <CardContent className="relative p-5 flex flex-col justify-between h-full gap-4">
          {/* Header */}
          <div
            className="flex items-center justify-between pb-3 border-b border-border/50 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setProfileOpen(true)}
            title="Abrir mi perfil"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-heading text-sm font-bold tracking-tight text-foreground">
                  Mi Perfil
                </h4>
                <p className="text-[11px] text-muted-foreground leading-none">
                  Conductor registrado
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[11px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            >
              Activo
            </Badge>
          </div>

          {/* Center: Avatar con botón rápido y datos principales */}
          <div className="my-auto py-2 flex flex-col items-center text-center">
            <div
              className="relative mb-3 group cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <ConductorAvatar
                fullName={fullName}
                photoUrl={profile?.photo_url}
                className="relative h-20 w-20 ring-4 ring-primary/20 shadow-md transition-transform group-hover:scale-105"
              />
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card hover:bg-primary/90 transition-colors">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="text-base font-bold font-heading text-foreground tracking-tight max-w-full px-2 hover:text-primary transition-colors"
              title="Abrir mi perfil"
            >
              {fullName}
            </button>

            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-data flex-wrap justify-center">
              {workerCode && <span>ID: {workerCode}</span>}
              {workerCode && rut && <span>•</span>}
              {rut && <span>RUT: {rut}</span>}
            </div>

            {/* Chips informativos */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {assignedPlate ? (
                <Badge variant="secondary" className="gap-1 font-mono text-[11px] py-0.5 px-2">
                  <Truck className="h-3 w-3 text-primary" /> {assignedPlate}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Sin vehículo asignado
                </Badge>
              )}

              {score != null && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[11px] border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold py-0.5 px-2"
                >
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {score}/10
                </Badge>
              )}
            </div>
          </div>

          {/* Footer: Input y Botón de actualización de foto */}
          <div className="pt-3 border-t border-border/50 shrink-0">
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
              className="w-full text-xs h-8 gap-1.5 font-medium"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {profile?.photo_url ? "Cambiar foto de perfil" : "Subir foto de perfil"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}