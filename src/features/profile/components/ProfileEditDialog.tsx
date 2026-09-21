import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { Camera, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { actualizarMiPerfil, subirFotoPerfil } from "@/features/profile/profileService";

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombres(profile?.nombres ?? profile?.full_name ?? "");
    setApellidoPaterno(profile?.apellido_paterno ?? "");
    setApellidoMaterno(profile?.apellido_materno ?? "");
    setRut(profile?.rut ?? "");
    setPhone(profile?.phone ?? "");
  }, [open, profile]);

  const handleFoto = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "El archivo no es válido", description: "Sube una imagen (JPG, PNG, o similar).", variant: "destructive" });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "El archivo es muy pesado", description: "La imagen debe pesar menos de 4 MB.", variant: "destructive" });
      return;
    }
    setSubiendoFoto(true);
    try {
      await subirFotoPerfil(user.id, file);
      await refreshProfile();
      toast({ title: "Foto actualizada", description: "Tu foto de perfil se subió correctamente." });
    } catch (error) {
      toast({ title: "Error al subir foto", description: error instanceof Error ? error.message : "No fue posible subir la foto", variant: "destructive" });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleGuardar = async () => {
    if (!nombres.trim() || !apellidoPaterno.trim() || !rut.trim()) {
      toast({
        title: "Faltan datos",
        description: "Nombres, apellido paterno y RUT son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    setGuardando(true);
    try {
      await actualizarMiPerfil({
        nombres,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno,
        rut,
        phone,
      });
      await refreshProfile();
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error al guardar", description: error instanceof Error ? error.message : "No se pudo guardar el perfil.", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Mi perfil</DialogTitle>
          <DialogDescription>
            Actualiza tus datos personales. Email y ID de trabajador son de solo lectura.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <ConductorAvatar fullName={profile?.full_name} photoUrl={profile?.photo_url} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile?.full_name || "Usuario"}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              handleFoto(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => inputRef.current?.click()}
            disabled={subiendoFoto}
          >
            {subiendoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {profile?.photo_url ? "Cambiar foto" : "Subir foto"}
          </Button>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="perfil-nombres">Nombres</Label>
            <Input id="perfil-nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Nombre(s)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-ap-paterno">Apellido paterno</Label>
              <Input id="perfil-ap-paterno" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} placeholder="Apellido paterno" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-ap-materno">Apellido materno</Label>
              <Input id="perfil-ap-materno" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} placeholder="Apellido materno" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-rut">RUT</Label>
              <Input id="perfil-rut" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="11111111-1" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-phone">Teléfono</Label>
              <Input id="perfil-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-email">Email</Label>
              <Input id="perfil-email" value={profile?.email ?? ""} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="perfil-worker">ID de trabajador</Label>
              <Input id="perfil-worker" value={profile?.worker_id ?? ""} disabled />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={guardando} className="gap-1.5">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}