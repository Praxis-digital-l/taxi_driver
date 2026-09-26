import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { uploadConductorPhoto } from "@/features/conductor/services/conductorProfileService";
import { supabase } from "@/integrations/supabase/client";
import {
  sanitizeInput,
  normalizeRut,
  validatePhone,
  validateRut,
  validateEmail,
  validateRequired,
} from "@/lib/validations";
import { Camera, KeyRound, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractEightDigits(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("569") && digits.length >= 11) {
    return digits.slice(3, 11);
  }
  return digits.slice(-8);
}

function formatRutInput(value: string): string {
  const raw = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!raw) return "";
  let cleaned = raw;
  if (cleaned.includes("K") && cleaned.lastIndexOf("K") !== cleaned.length - 1) {
    cleaned = cleaned.replace(/K/g, "");
  }
  if (cleaned.length > 9) cleaned = cleaned.slice(0, 9);
  if (cleaned.length <= 1) return cleaned;
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [customFullName, setCustomFullName] = useState(false);
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [rutInput, setRutInput] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      let initialNombres = profile.nombres || "";
      let initialPaterno = profile.apellido_paterno || "";
      let initialMaterno = profile.apellido_materno || "";

      if (!initialNombres && !initialPaterno && profile.full_name) {
        const parts = profile.full_name.trim().split(/\s+/);
        initialNombres = parts[0] || "";
        initialPaterno = parts[1] || "";
        initialMaterno = parts.slice(2).join(" ") || "";
      }

      setNombres(initialNombres);
      setApellidoPaterno(initialPaterno);
      setApellidoMaterno(initialMaterno);
      setFullNameInput(
        profile.full_name ||
          [initialNombres, initialPaterno, initialMaterno].filter(Boolean).join(" ")
      );
      setCustomFullName(false);
      setEmail(profile.email || user?.email || "");
      setPhoneDigits(extractEightDigits(profile.phone));
      setRutInput(profile.rut ? formatRutInput(profile.rut) : "");
      setWorkerId(profile.worker_id || "");
      setPhotoUrl(profile.photo_url || null);
      setFieldErrors({});
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open, profile, user]);

  useEffect(() => {
    if (!customFullName) {
      const built = [nombres.trim(), apellidoPaterno.trim(), apellidoMaterno.trim()]
        .filter(Boolean)
        .join(" ");
      if (built) {
        setFullNameInput(built);
      }
    }
  }, [nombres, apellidoPaterno, apellidoMaterno, customFullName]);

  const handleUploadPhoto = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo no válido",
        description: "Selecciona una imagen (JPG, PNG, WEBP).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "Imagen muy pesada",
        description: "La imagen debe pesar menos de 4 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const uploadedUrl = await uploadConductorPhoto(user.id, file);
      setPhotoUrl(uploadedUrl);
      await refreshProfile();
      toast({
        title: "Foto de perfil actualizada",
        description: "Tu foto se guardó correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al subir foto",
        description: error instanceof Error ? error.message : "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile) return;
    setUploadingPhoto(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ photo_url: null })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);
      setPhotoUrl(null);
      await refreshProfile();
      toast({ title: "Foto de perfil eliminada" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo quitar la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const rawPhoneDigits = phoneDigits.trim();
    const formattedPhone = rawPhoneDigits ? `+569${rawPhoneDigits}` : "";
    const rawRut = rutInput.trim();

    const errors: Record<string, string | null> = {
      nombres: validateRequired(nombres, "Nombre"),
      apellido_paterno: validateRequired(apellidoPaterno, "Apellido paterno"),
      email: validateEmail(email),
      phone: validatePhone(formattedPhone),
      rut: validateRut(rawRut),
    };

    setFieldErrors(errors);
    const firstError = Object.values(errors).find((err) => err !== null);
    if (firstError) {
      toast({
        title: "Datos inválidos o incompletos",
        description: firstError,
        variant: "destructive",
      });
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        toast({
          title: "Contraseña muy corta",
          description: "La nueva contraseña debe tener al menos 6 caracteres.",
          variant: "destructive",
        });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({
          title: "Las contraseñas no coinciden",
          description: "Verifica que ambas contraseñas sean iguales.",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const nombresClean = sanitizeInput(nombres.trim());
      const paternoClean = sanitizeInput(apellidoPaterno.trim());
      const maternoClean = sanitizeInput(apellidoMaterno.trim());
      const joinedName = [nombresClean, paternoClean, maternoClean].filter(Boolean).join(" ");
      const fullNameClean = sanitizeInput(fullNameInput.trim()) || joinedName;
      const emailClean = email.trim().toLowerCase();
      const phoneClean = formattedPhone;
      const rutClean = normalizeRut(rawRut);

      // Nota: worker_id y score NO se incluyen porque no se editan desde Mi Perfil.
      const updatePayload: Record<string, string | null> = {
        nombres: nombresClean,
        apellido_paterno: paternoClean,
        apellido_materno: maternoClean,
        full_name: fullNameClean,
        email: emailClean,
        phone: phoneClean,
        rut: rutClean,
        photo_url: photoUrl,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", profile.id);

      if (profileError) throw new Error(profileError.message);

      const passwordChanged = Boolean(newPassword);
      if (passwordChanged) {
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (authError) throw new Error(authError.message);
      }

      await refreshProfile();
      toast({
        title: "Perfil actualizado",
        description: passwordChanged
          ? "Tus datos de perfil y tu contraseña han sido actualizados."
          : "Todos los cambios de tu perfil se guardaron correctamente.",
      });
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error al guardar perfil",
        description: error instanceof Error ? error.message : "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    fullNameInput.trim() ||
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mi Perfil";

  const roleLabel =
    profile?.role === "super_admin"
      ? "Super Administrador"
      : profile?.role === "admin"
        ? "Administrador"
        : "Conductor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            Mi Perfil
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Cabecera con foto de perfil */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className="relative group shrink-0">
              <ConductorAvatar
                fullName={displayName}
                photoUrl={photoUrl}
                className="h-20 w-20 ring-4 ring-primary/20 shadow-md"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background hover:bg-primary/90 transition-colors"
                title="Cambiar foto"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleUploadPhoto(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <p className="font-heading font-bold text-base truncate">{displayName}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Badge variant="secondary" className="text-[11px] gap-1">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  {roleLabel}
                </Badge>
                {workerId && (
                  <Badge variant="outline" className="text-[11px] font-mono">
                    ID: {workerId}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 h-3 w-3" />
                  {photoUrl ? "Cambiar foto" : "Subir foto"}
                </Button>
                {photoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    disabled={uploadingPhoto}
                    onClick={handleRemovePhoto}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Datos Personales
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombres *</Label>
                <Input
                  value={nombres}
                  onChange={(e) => {
                    setNombres(e.target.value);
                    if (fieldErrors.nombres) setFieldErrors((prev) => ({ ...prev, nombres: null }));
                  }}
                  required
                  placeholder="Ej. Carlos"
                  maxLength={80}
                />
                {fieldErrors.nombres && (
                  <p className="text-[11px] text-destructive">{fieldErrors.nombres}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Apellido Paterno *</Label>
                <Input
                  value={apellidoPaterno}
                  onChange={(e) => {
                    setApellidoPaterno(e.target.value);
                    if (fieldErrors.apellido_paterno) {
                      setFieldErrors((prev) => ({ ...prev, apellido_paterno: null }));
                    }
                  }}
                  required
                  placeholder="Ej. Muñoz"
                  maxLength={80}
                />
                {fieldErrors.apellido_paterno && (
                  <p className="text-[11px] text-destructive">{fieldErrors.apellido_paterno}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Apellido Materno</Label>
                <Input
                  value={apellidoMaterno}
                  onChange={(e) => setApellidoMaterno(e.target.value)}
                  placeholder="Ej. Rojas"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nombre Completo (Visible en perfil)</Label>
              <Input
                value={fullNameInput}
                onChange={(e) => {
                  setCustomFullName(true);
                  setFullNameInput(e.target.value);
                }}
                placeholder="Nombre visible en la plataforma"
                maxLength={160}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Correo Electrónico *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
                  }}
                  required
                  placeholder="correo@ejemplo.cl"
                  maxLength={254}
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none z-10">
                    +569
                  </span>
                  <Input
                    value={phoneDigits}
                    onChange={(e) => {
                      const nextDigits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setPhoneDigits(nextDigits);
                      if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: null }));
                    }}
                    required
                    placeholder="12345678"
                    className={`pl-12 ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-[11px] text-destructive">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">RUT *</Label>
                <Input
                  value={rutInput}
                  onChange={(e) => {
                    const formatted = formatRutInput(e.target.value);
                    setRutInput(formatted);
                    if (fieldErrors.rut) setFieldErrors((prev) => ({ ...prev, rut: null }));
                  }}
                  required
                  placeholder="12.345.678-5"
                  maxLength={15}
                  className={fieldErrors.rut ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {fieldErrors.rut && (
                  <p className="text-[11px] text-destructive">{fieldErrors.rut}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ID de Trabajador (No editable)</Label>
                <Input
                  value={workerId || "Sin asignar"}
                  disabled
                  readOnly
                  className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          {/* Seguridad / Cambiar contraseña */}
          <div className="space-y-3 rounded-xl border p-3.5 bg-muted/15">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              Cambiar Contraseña (Opcional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nueva Contraseña</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Dejar vacío para mantener"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirmar Contraseña</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir nueva contraseña"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploadingPhoto}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}