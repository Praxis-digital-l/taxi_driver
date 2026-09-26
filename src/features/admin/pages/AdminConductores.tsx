import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import {
  Plus, UserRound, Search, Eye, Pencil, Truck, Phone, Mail, Fingerprint, Trash2, Star, Camera, KeyRound, Loader2
} from "lucide-react";
import {
  fetchAdminConductores,
  createConductor,
  updateConductor,
  updateConductorScore,
  uploadConductorAvatarByAdmin,
  deleteConductor,
  fetchConductorDetail,
  type ConductorRecord,
  type ConductorDetailRecord,
  type ConductorVehicleRecord,
  ESTADO_CONDUCTOR_OPTIONS,
  ESTADO_CONDUCTOR_STYLES,
  ESTADO_CONDUCTOR_LABELS,
} from "@/features/admin/services/adminConductoresService";
import {
  assignConductorToVehicle,
  removeVehicleAssignment,
  type VehicleRecord,
} from "@/features/admin/services/adminVehiclesService";
import { supabase } from "@/integrations/supabase/client";
import {
  validateConductorForm,
  sanitizeInput,
  normalizeRut,
  validatePhone,
  validateRut,
  validateEmail,
  validateRequired,
} from "@/lib/validations";

function extractPhoneDigits(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("569") && digits.length >= 11) {
    return digits.slice(3, 11);
  }
  return digits.slice(-8);
}

function formatRutDisplay(value?: string | null): string {
  if (!value) return "";
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

export default function AdminConductores() {
  const { toast } = useToast();
  const [conductores, setConductores] = useState<ConductorRecord[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<VehicleRecord[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedConductor, setSelectedConductor] = useState<ConductorDetailRecord | null>(null);
  const [editConductor, setEditConductor] = useState<ConductorRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string | null>>({});
  const [phoneDigits, setPhoneDigits] = useState("");
  const [rutInput, setRutInput] = useState("");
  const [editNombres, setEditNombres] = useState("");
  const [editApellidoPaterno, setEditApellidoPaterno] = useState("");
  const [editApellidoMaterno, setEditApellidoMaterno] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editCustomFullName, setEditCustomFullName] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editWorkerId, setEditWorkerId] = useState("");
  const [editPhoneDigits, setEditPhoneDigits] = useState("");
  const [editRutInput, setEditRutInput] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editScoreValue, setEditScoreValue] = useState("null");
  const [editEstadoValue, setEditEstadoValue] = useState("nuevo");
  const [editPassword, setEditPassword] = useState("");
  const [editAssignedVehicles, setEditAssignedVehicles] = useState<ConductorVehicleRecord[]>([]);
  const [selectedVehicleToAssign, setSelectedVehicleToAssign] = useState("");
  const [assigningVehicle, setAssigningVehicle] = useState(false);
  const [uploadingEditAvatar, setUploadingEditAvatar] = useState(false);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConductorRecord | null>(null);
  const [scoreValue, setScoreValue] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, vehiclesRes] = await Promise.all([
        fetchAdminConductores(),
        supabase
          .from("vehicles")
          .select("id, license_plate, make, model, year, color, status")
          .order("license_plate", { ascending: true }),
      ]);
      setConductores(data);
      if (vehiclesRes.data) {
        setFleetVehicles(vehiclesRes.data as VehicleRecord[]);
      }
    } catch (error) {
      toast({
        title: "Error cargando conductores",
        description: error instanceof Error ? error.message : "No se pudieron cargar los datos",
        variant: "destructive",
      });
    }
  }, [toast]);

  
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editConductor) {
      let initialNombres = editConductor.nombres || "";
      let initialPaterno = editConductor.apellido_paterno || "";
      let initialMaterno = editConductor.apellido_materno || "";

      if (!initialNombres && !initialPaterno && editConductor.full_name) {
        const parts = editConductor.full_name.trim().split(/\s+/);
        initialNombres = parts[0] || "";
        initialPaterno = parts[1] || "";
        initialMaterno = parts.slice(2).join(" ") || "";
      }

      setEditNombres(initialNombres);
      setEditApellidoPaterno(initialPaterno);
      setEditApellidoMaterno(initialMaterno);
      setEditFullName(
        editConductor.full_name ||
          [initialNombres, initialPaterno, initialMaterno].filter(Boolean).join(" ")
      );
      setEditCustomFullName(false);
      setEditEmail(editConductor.email || "");
      setEditWorkerId(editConductor.worker_id || "");
      setEditPhoneDigits(extractPhoneDigits(editConductor.phone));
      setEditRutInput(formatRutDisplay(editConductor.rut));
      setEditPhotoUrl(editConductor.photo_url || null);
      setEditScoreValue(editConductor.score != null ? String(editConductor.score) : "null");
      setEditEstadoValue(editConductor.estado_conductor || "nuevo");
      setEditPassword("");
      setEditErrors({});
      setSelectedVehicleToAssign("");

      fetchConductorDetail(editConductor.id)
        .then((detail) => setEditAssignedVehicles(detail.vehicles))
        .catch(() => setEditAssignedVehicles([]));
    } else {
      setEditAssignedVehicles([]);
    }
  }, [editConductor]);

  useEffect(() => {
    if (!editCustomFullName) {
      const built = [editNombres.trim(), editApellidoPaterno.trim(), editApellidoMaterno.trim()]
        .filter(Boolean)
        .join(" ");
      if (built) {
        setEditFullName(built);
      }
    }
  }, [editNombres, editApellidoPaterno, editApellidoMaterno, editCustomFullName]);

  const handleAssignVehicleInProfile = async (profileId: string) => {
    if (!selectedVehicleToAssign) return;
    setAssigningVehicle(true);
    try {
      await assignConductorToVehicle(selectedVehicleToAssign, profileId);
      const detail = await fetchConductorDetail(profileId);
      setEditAssignedVehicles(detail.vehicles);
      if (selectedConductor?.id === profileId) {
        setSelectedConductor(detail);
      }
      setSelectedVehicleToAssign("");
      toast({ title: "Vehículo asignado al perfil" });
    } catch (error) {
      toast({
        title: "Error al asignar vehículo",
        description: error instanceof Error ? error.message : "No se pudo asignar el vehículo",
        variant: "destructive",
      });
    } finally {
      setAssigningVehicle(false);
    }
  };

  const handleUnassignVehicleInProfile = async (assignmentId: string, profileId: string) => {
    setAssigningVehicle(true);
    try {
      await removeVehicleAssignment(assignmentId);
      const detail = await fetchConductorDetail(profileId);
      setEditAssignedVehicles(detail.vehicles);
      if (selectedConductor?.id === profileId) {
        setSelectedConductor(detail);
      }
      toast({ title: "Vehículo desvinculado del perfil" });
    } catch (error) {
      toast({
        title: "Error al quitar vehículo",
        description: error instanceof Error ? error.message : "No se pudo desvincular el vehículo",
        variant: "destructive",
      });
    } finally {
      setAssigningVehicle(false);
    }
  };

  const handleEditAvatarUpload = async (file: File | undefined) => {
    if (!file || !editConductor) return;
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

    setUploadingEditAvatar(true);
    try {
      const url = await uploadConductorAvatarByAdmin(editConductor.id, file);
      setEditPhotoUrl(url);
      toast({ title: "Foto del conductor actualizada" });
    } catch (error) {
      toast({
        title: "Error al subir foto",
        description: error instanceof Error ? error.message : "No se pudo subir la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingEditAvatar(false);
    }
  };

  const filteredConductores = useMemo(() => {
    let result = conductores;
    if (filter !== "all") {
      result = result.filter((c) => c.estado_conductor === filter);
    }
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (c) =>
          c.full_name.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.rut.toLowerCase().includes(term) ||
          c.nombres.toLowerCase().includes(term) ||
          c.apellido_paterno.toLowerCase().includes(term) ||
          c.apellido_materno.toLowerCase().includes(term),
      );
    }
    return result;
  }, [conductores, filter, search]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("phone", `+569${String(form.get("phone") || "").trim()}`);
    const errors = validateConductorForm(form);
    const phoneValue = String(form.get("phone") || "").trim();
    const rutValue = normalizeRut(String(form.get("rut") || ""));
    const duplicateRut = conductores.find((c) => c.rut === rutValue);
    const duplicatePhone = conductores.find((c) => c.phone === phoneValue);
    if (duplicateRut) errors.rut = "Ya existe un conductor con este RUT";
    if (duplicatePhone) errors.phone = "Ya existe un conductor con este teléfono";
    setFormErrors(errors);

    const hasErrors = Object.values(errors).some((e) => e !== null);
    if (hasErrors) {
      setLoading(false);
      return;
    }

    try {
      await createConductor({
        nombres: sanitizeInput(String(form.get("nombres") || "")),
        apellidoPaterno: sanitizeInput(String(form.get("apellido_paterno") || "")),
        apellidoMaterno: sanitizeInput(String(form.get("apellido_materno") || "")),
        email: String(form.get("email") || "").trim(),
        phone: phoneValue,
        rut: rutValue,
        password: String(form.get("password") || ""),
      });
      toast({ title: "Conductor creado exitosamente" });
      setOpenCreate(false);
      setFormErrors({});
      setPhoneDigits("");
      setRutInput("");
      formElement.reset();
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el conductor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editConductor) return;

    const rawPhoneDigits = editPhoneDigits.trim();
    const formattedPhone = rawPhoneDigits ? `+569${rawPhoneDigits}` : "";
    const rawRut = editRutInput.trim();
    const normalizedRut = rawRut ? normalizeRut(rawRut) : "";
    const parsedScore = editScoreValue === "null" || editScoreValue === "" ? null : Number(editScoreValue);

    const errors: Record<string, string | null> = {
      nombres: validateRequired(editNombres, "Nombre"),
      apellido_paterno: validateRequired(editApellidoPaterno, "Apellido paterno"),
      email: validateEmail(editEmail),
      phone: validatePhone(formattedPhone),
      rut: validateRut(rawRut),
    };

    if (!errors.rut && normalizedRut) {
      const duplicateRut = conductores.find(
        (c) => c.id !== editConductor.id && normalizeRut(c.rut || "") === normalizedRut
      );
      if (duplicateRut) {
        errors.rut = "Ya existe otro conductor con este RUT";
      }
    }

    if (!errors.phone && formattedPhone) {
      const duplicatePhone = conductores.find(
        (c) => c.id !== editConductor.id && c.phone === formattedPhone
      );
      if (duplicatePhone) {
        errors.phone = "Ya existe otro conductor con este teléfono";
      }
    }

    setEditErrors(errors);
    const firstError = Object.values(errors).find((err) => err !== null);
    if (firstError) {
      toast({
        title: "Datos inválidos o incompletos",
        description: firstError,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await updateConductor(editConductor.id, {
        nombres: sanitizeInput(editNombres),
        apellidoPaterno: sanitizeInput(editApellidoPaterno),
        apellidoMaterno: sanitizeInput(editApellidoMaterno),
        fullName: sanitizeInput(editFullName),
        email: editEmail.trim().toLowerCase(),
        phone: formattedPhone,
        rut: normalizedRut,
        estado_conductor: editEstadoValue,
        score: parsedScore,
        photo_url: editPhotoUrl,
        password: editPassword.trim() || undefined,
        existing_user_id: editConductor.user_id || undefined,
      });
      toast({
        title: "Perfil del conductor actualizado",
        description: editPassword.trim()
          ? "Se guardaron los datos del perfil y se actualizó su contraseña de acceso."
          : "Todos los cambios del perfil se guardaron correctamente.",
      });
      setOpenEdit(false);
      setEditConductor(null);
      setEditPassword("");
      setEditErrors({});
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar el conductor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await deleteConductor(deleteTarget.id, deleteTarget.user_id);
      toast({ title: "Conductor eliminado exitosamente" });
      setOpenDelete(false);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el conductor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScore = async () => {
    if (!selectedConductor) return;
    setSavingScore(true);
    try {
      const nextScore = scoreValue === "" ? null : Number(scoreValue);
      await updateConductorScore(selectedConductor.id, nextScore);
      setSelectedConductor({ ...selectedConductor, score: nextScore });
      toast({ title: "Puntuación guardada exitosamente" });
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar la puntuación",
        variant: "destructive",
      });
    } finally {
      setSavingScore(false);
    }
  };

  const handleViewDetail = async (conductor: ConductorRecord) => {
    setLoading(true);
    try {
      const detail = await fetchConductorDetail(conductor.id);
      setSelectedConductor(detail);
      setScoreValue(detail.score ? String(detail.score) : "");
      setOpenDetail(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cargar el detalle",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Gestión de Conductores" description={`${conductores.length} conductores registrados`}>
        <div className="flex flex-wrap items-center gap-2 w-full min-w-0 sm:w-auto">
          <div className="relative flex-1 min-w-[10rem] sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar conductor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-[200px] h-8 pl-8 text-xs"
            />
          </div>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADO_CONDUCTOR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={openCreate} onOpenChange={(open) => { if (!open) { setPhoneDigits(""); setRutInput(""); setFormErrors({}); } setOpenCreate(open); }}>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle className="font-heading">Agregar Conductor</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input name="nombres" required placeholder="Carlos" maxLength={80} />
                  {formErrors.nombres && <p className="text-[11px] text-destructive">{formErrors.nombres}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Apellido paterno *</Label>
                  <Input name="apellido_paterno" required placeholder="Muñoz" maxLength={80} />
                  {formErrors.apellido_paterno && <p className="text-[11px] text-destructive">{formErrors.apellido_paterno}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Apellido materno</Label>
                  <Input name="apellido_materno" placeholder="Rojas" maxLength={80} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Correo electrónico *</Label>
                  <Input name="email" type="email" required placeholder="correo@santaaurora.cl" maxLength={254} />
                  {formErrors.email && <p className="text-[11px] text-destructive">{formErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none z-10">
                      +569
                    </span>
                    <Input
                      name="phone"
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      required
                      placeholder="XXXX XXXX"
                      className="pl-12"
                    />
                  </div>
                  {formErrors.phone && <p className="text-[11px] text-destructive">{formErrors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>RUT *</Label>
                  <Input
                    name="rut"
                    value={rutInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9kK]/g, "").toUpperCase();
                      if (!raw) { setRutInput(""); return; }
                      let cleaned = raw;
                      if (cleaned.includes("K") && cleaned.lastIndexOf("K") !== cleaned.length - 1) {
                        cleaned = cleaned.replace(/K/g, "");
                      }
                      if (cleaned.length > 9) return;
                      if (cleaned.length <= 1) { setRutInput(cleaned); return; }
                      const dv = cleaned.slice(-1);
                      const body = cleaned.slice(0, -1);
                      const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                      setRutInput(`${formattedBody}-${dv}`);
                    }}
                    required
                    placeholder="12.345.678-5"
                    maxLength={15}
                  />
                  {formErrors.rut && <p className="text-[11px] text-destructive">{formErrors.rut}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Contraseña *</Label>
                  <Input name="password" type="password" required minLength={6} placeholder="Mín. 6 caracteres" />
                  {formErrors.password && <p className="text-[11px] text-destructive">{formErrors.password}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Crear Conductor"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Agregar Conductor
        </Button>
      </PageHeader>

      {filteredConductores.length === 0 ? (
        <Card>
          <CardContent className="empty-state">
            <UserRound />
            <p>{search || filter !== "all" ? "No hay conductores que coincidan con la búsqueda." : "No hay conductores registrados aún."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredConductores.map((conductor) => (
            <Card key={conductor.id} className="stat-card overflow-hidden">
              <div className="bg-muted/50 border-b px-5 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <ConductorAvatar
                    fullName={conductor.full_name}
                    photoUrl={conductor.photo_url}
                    className="h-9 w-9 shrink-0 ring-2 ring-primary/15"
                  />
                  <div className="min-w-0">
                    <p className="font-heading font-medium truncate">
                      {conductor.full_name || "Sin nombre"}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{conductor.email || "Sin correo"}</span>
                    </div>
                  </div>
                </div>
                {conductor.score !== null && conductor.score !== undefined && (
                  <Badge variant="outline" className="text-[10px] shrink-0 bg-warning/10 text-warning border-warning/20">
                    <Star className="mr-1 h-3 w-3 fill-current" />{conductor.score}/10
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] shrink-0 ${ESTADO_CONDUCTOR_STYLES[conductor.estado_conductor] || ""}`}>
                  {ESTADO_CONDUCTOR_LABELS[conductor.estado_conductor] || conductor.estado_conductor}
                </Badge>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{conductor.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Fingerprint className="h-3 w-3 shrink-0" />
                    <span className="truncate">{conductor.rut || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => handleViewDetail(conductor)}
                  >
                    <Eye className="mr-1 h-3 w-3" /> Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setEditConductor(conductor);
                      setOpenEdit(true);
                    }}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setDeleteTarget(conductor);
                      setOpenDelete(true);
                    }}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openDelete} onOpenChange={(open) => { if (!open) { setOpenDelete(false); setDeleteTarget(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Eliminar Conductor</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de eliminar a <strong>{deleteTarget.full_name}</strong>?
                <br />
                Se eliminarán todos sus datos asociados (vehículos asignados, documentos, solicitudes, etc.) y no se podrá recuperar.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setOpenDelete(false); setDeleteTarget(null); }}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" disabled={loading} onClick={handleDelete}>
                  {loading ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={openEdit}
        onOpenChange={(open) => {
          if (!open) {
            setOpenEdit(false);
            setEditConductor(null);
            setEditPhoneDigits("");
            setEditRutInput("");
            setEditPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-heading">Personalizar Perfil del Conductor</DialogTitle>
          </DialogHeader>
          {editConductor && (
            <form onSubmit={handleEdit} className="space-y-4">
              {/* Foto de perfil del conductor */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-muted/30 border">
                <div className="relative shrink-0">
                  <ConductorAvatar
                    fullName={editFullName || editConductor.full_name}
                    photoUrl={editPhotoUrl}
                    className="h-16 w-16 ring-2 ring-primary/20 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => editAvatarInputRef.current?.click()}
                    disabled={uploadingEditAvatar}
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background hover:bg-primary/90"
                    title="Cambiar foto"
                  >
                    {uploadingEditAvatar ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                  </button>
                  <input
                    ref={editAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleEditAvatarUpload(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {editFullName || editConductor.full_name || "Conductor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {editConductor.user_id ? "Cuenta con inicio de sesión activo" : "Sin contraseña configurada"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={uploadingEditAvatar}
                      onClick={() => editAvatarInputRef.current?.click()}
                    >
                      <Camera className="mr-1.5 h-3 w-3" />
                      {editPhotoUrl ? "Cambiar foto" : "Subir foto"}
                    </Button>
                    {editPhotoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={uploadingEditAvatar}
                        onClick={() => setEditPhotoUrl(null)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombres *</Label>
                  <Input
                    name="nombres"
                    value={editNombres}
                    onChange={(e) => {
                      setEditNombres(e.target.value);
                      if (editErrors.nombres) setEditErrors((prev) => ({ ...prev, nombres: null }));
                    }}
                    required
                    placeholder="Carlos"
                    maxLength={80}
                  />
                  {editErrors.nombres && (
                    <p className="text-[11px] text-destructive">{editErrors.nombres}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Apellido paterno *</Label>
                  <Input
                    name="apellido_paterno"
                    value={editApellidoPaterno}
                    onChange={(e) => {
                      setEditApellidoPaterno(e.target.value);
                      if (editErrors.apellido_paterno) {
                        setEditErrors((prev) => ({ ...prev, apellido_paterno: null }));
                      }
                    }}
                    required
                    placeholder="Muñoz"
                    maxLength={80}
                  />
                  {editErrors.apellido_paterno && (
                    <p className="text-[11px] text-destructive">{editErrors.apellido_paterno}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Apellido materno</Label>
                  <Input
                    name="apellido_materno"
                    value={editApellidoMaterno}
                    onChange={(e) => setEditApellidoMaterno(e.target.value)}
                    placeholder="Rojas"
                    maxLength={80}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Nombre Completo (Visible en perfil)</Label>
                <Input
                  value={editFullName}
                  onChange={(e) => {
                    setEditCustomFullName(true);
                    setEditFullName(e.target.value);
                  }}
                  placeholder="Nombre visible del conductor"
                  maxLength={160}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Correo electrónico *</Label>
                  <Input
                    name="email"
                    value={editEmail}
                    onChange={(e) => {
                      setEditEmail(e.target.value);
                      if (editErrors.email) setEditErrors((prev) => ({ ...prev, email: null }));
                    }}
                    type="email"
                    required
                    placeholder="correo@ejemplo.cl"
                    maxLength={254}
                  />
                  {editErrors.email && (
                    <p className="text-[11px] text-destructive">{editErrors.email}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Teléfono *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none z-10">
                      +569
                    </span>
                    <Input
                      name="phone"
                      value={editPhoneDigits}
                      onChange={(e) => {
                        setEditPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8));
                        if (editErrors.phone) setEditErrors((prev) => ({ ...prev, phone: null }));
                      }}
                      required
                      placeholder="12345678"
                      className={`pl-12 ${editErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {editErrors.phone && (
                    <p className="text-[11px] text-destructive">{editErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">RUT *</Label>
                  <Input
                    name="rut"
                    value={editRutInput}
                    onChange={(e) => {
                      setEditRutInput(formatRutDisplay(e.target.value));
                      if (editErrors.rut) setEditErrors((prev) => ({ ...prev, rut: null }));
                    }}
                    required
                    placeholder="12.345.678-5"
                    maxLength={15}
                    className={editErrors.rut ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {editErrors.rut && (
                    <p className="text-[11px] text-destructive">{editErrors.rut}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID de Trabajador (No editable)</Label>
                  <Input
                    name="worker_id"
                    value={editWorkerId || "Sin asignar"}
                    disabled
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado conductor</Label>
                  <Select value={editEstadoValue} onValueChange={setEditEstadoValue}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADO_CONDUCTOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Puntuación (1 a 10)</Label>
                  <Select value={editScoreValue} onValueChange={setEditScoreValue}>
                    <SelectTrigger><SelectValue placeholder="Sin puntuar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Sin puntuar</SelectItem>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} / 10</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Vehículos asignados en el perfil */}
              <div className="rounded-xl border p-3.5 bg-muted/15 space-y-2.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  Vehículos Asignados ({editAssignedVehicles.length})
                </Label>
                {editAssignedVehicles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin vehículos asignados</p>
                ) : (
                  <div className="space-y-1.5">
                    {editAssignedVehicles.map((va) => (
                      <div
                        key={va.id}
                        className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-mono font-semibold">{va.vehicles?.license_plate || "—"}</span>
                          <span className="text-muted-foreground truncate">
                            {va.vehicles?.make} {va.vehicles?.model}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-destructive hover:text-destructive shrink-0"
                          disabled={assigningVehicle}
                          onClick={() => handleUnassignVehicleInProfile(va.id, editConductor.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Select value={selectedVehicleToAssign} onValueChange={setSelectedVehicleToAssign}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Seleccionar vehículo para asignar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fleetVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.license_plate} — {[v.make, v.model].filter(Boolean).join(" ") || "Vehículo"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={!selectedVehicleToAssign || assigningVehicle}
                    onClick={() => handleAssignVehicleInProfile(editConductor.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Asignar
                  </Button>
                </div>
              </div>

              {/* Asignar o cambiar contraseña de acceso */}
              <div className="rounded-xl border p-3.5 bg-muted/15 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Contraseña de Inicio de Sesión (Opcional)
                </Label>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={
                    editConductor.user_id
                      ? "Dejar vacío para mantener la contraseña actual"
                      : "Ingresa una contraseña (mín. 6 caracteres) para activar su acceso"
                  }
                  autoComplete="new-password"
                />
                <p className="text-[11px] text-muted-foreground">
                  {editConductor.user_id
                    ? "Si escribes una nueva contraseña aquí, se actualizará la clave con la que inicia sesión."
                    : "Este conductor fue cargado sin contraseña. Ingresa una clave aquí para que pueda iniciar sesión con su correo."}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading || uploadingEditAvatar}>
                {loading ? "Guardando..." : "Guardar Cambios del Perfil"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openDetail} onOpenChange={(open) => { if (!open) { setOpenDetail(false); setSelectedConductor(null); setScoreValue(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Perfil del Conductor</DialogTitle>
          </DialogHeader>
          {selectedConductor && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border">
                <div className="flex items-center gap-4 min-w-0">
                  <ConductorAvatar
                    fullName={selectedConductor.full_name}
                    photoUrl={selectedConductor.photo_url}
                    className="h-14 w-14 shrink-0 ring-2 ring-primary/20"
                  />
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-lg truncate">
                      {selectedConductor.full_name || "Sin nombre"}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${ESTADO_CONDUCTOR_STYLES[selectedConductor.estado_conductor] || ""}`}>
                        {ESTADO_CONDUCTOR_LABELS[selectedConductor.estado_conductor] || selectedConductor.estado_conductor}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {selectedConductor.user_id ? "Acceso activo" : "Sin contraseña"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => {
                    const target = selectedConductor;
                    setOpenDetail(false);
                    setEditConductor(target);
                    setOpenEdit(true);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Personalizar
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Nombres</p>
                  <p className="font-medium">{selectedConductor.nombres || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Apellidos</p>
                  <p className="font-medium">
                    {[selectedConductor.apellido_paterno, selectedConductor.apellido_materno].filter(Boolean).join(" ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Correo</p>
                  <p className="font-medium break-all">{selectedConductor.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{selectedConductor.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RUT</p>
                  <p className="font-medium">{selectedConductor.rut || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID Trabajador</p>
                  <p className="font-medium">{selectedConductor.worker_id || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registrado desde</p>
                  <p className="font-medium">{new Date(selectedConductor.created_at).toLocaleDateString("es-CL")}</p>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-warning" /> Puntuación del conductor
                </p>
                <div className="flex items-end gap-3">
                  <div className="space-y-2 flex-1">
                    <Label className="text-xs text-muted-foreground">Nota (1 a 10)</Label>
                    <Select
                      value={scoreValue}
                      onValueChange={(value) => setScoreValue(value === "null" ? "" : value)}
                    >
                      <SelectTrigger><SelectValue placeholder="Sin puntuar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">Sin puntuar</SelectItem>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" disabled={savingScore} onClick={handleSaveScore}>
                    {savingScore ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Truck className="h-4 w-4" /> Vehículos asignados ({selectedConductor.vehicles.length})
                </p>
                {selectedConductor.vehicles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin vehículos asignados</p>
                ) : (
                  <div className="space-y-2">
                    {selectedConductor.vehicles.map((va) => (
                      <div key={va.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-sm">
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{va.vehicles?.license_plate || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {va.vehicles?.make} {va.vehicles?.model} ({va.vehicles?.year || "—"})
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                          disabled={assigningVehicle}
                          onClick={() => handleUnassignVehicleInProfile(va.id, selectedConductor.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Select value={selectedVehicleToAssign} onValueChange={setSelectedVehicleToAssign}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Asignar vehículo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fleetVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.license_plate} — {[v.make, v.model].filter(Boolean).join(" ") || "Vehículo"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={!selectedVehicleToAssign || assigningVehicle}
                    onClick={() => handleAssignVehicleInProfile(selectedConductor.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Asignar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

