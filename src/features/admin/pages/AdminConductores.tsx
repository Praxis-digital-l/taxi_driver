import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Plus, UserRound, Search, Eye, Pencil, Truck, Phone, Mail, Fingerprint } from "lucide-react";
import {
  fetchAdminConductores,
  createConductor,
  updateConductor,
  fetchConductorDetail,
  type ConductorRecord,
  type ConductorDetailRecord,
  ESTADO_CONDUCTOR_OPTIONS,
  ESTADO_CONDUCTOR_STYLES,
  ESTADO_CONDUCTOR_LABELS,
} from "@/features/admin/services/adminConductoresService";
import { validateConductorForm, sanitizeInput } from "@/lib/validations";

export default function AdminConductores() {
  const { toast } = useToast();
  const [conductores, setConductores] = useState<ConductorRecord[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedConductor, setSelectedConductor] = useState<ConductorDetailRecord | null>(null);
  const [editConductor, setEditConductor] = useState<ConductorRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminConductores();
      setConductores(data);
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
    const errors = validateConductorForm(form);
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
        phone: String(form.get("phone") || "").trim(),
        rut: String(form.get("rut") || "").trim(),
        password: String(form.get("password") || ""),
      });
      toast({ title: "Conductor creado exitosamente" });
      setOpenCreate(false);
      setFormErrors({});
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
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const estadoConductor = String(form.get("estado_conductor") || "");

    try {
      await updateConductor(editConductor.id, {
        nombres: sanitizeInput(String(form.get("nombres") || "")),
        apellidoPaterno: sanitizeInput(String(form.get("apellido_paterno") || "")),
        apellidoMaterno: sanitizeInput(String(form.get("apellido_materno") || "")),
        phone: String(form.get("phone") || "").trim(),
        rut: String(form.get("rut") || "").trim(),
        estado_conductor: estadoConductor,
      });
      toast({ title: "Conductor actualizado exitosamente" });
      setOpenEdit(false);
      setEditConductor(null);
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

  const handleViewDetail = async (conductor: ConductorRecord) => {
    setLoading(true);
    try {
      const detail = await fetchConductorDetail(conductor.id);
      setSelectedConductor(detail);
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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar conductor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px] h-8 pl-8 text-xs"
          />
        </div>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ESTADO_CONDUCTOR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle className="font-heading">Agregar Conductor</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
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
                  <Input name="phone" required placeholder="+56 9 XXXX XXXX" maxLength={20} />
                  {formErrors.phone && <p className="text-[11px] text-destructive">{formErrors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>RUT *</Label>
                  <Input name="rut" required placeholder="12.345.678-5" maxLength={12} />
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-medium truncate">{conductor.full_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{conductor.email}</span>
                    </div>
                  </div>
                </div>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openEdit} onOpenChange={(open) => { if (!open) { setOpenEdit(false); setEditConductor(null); } }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle className="font-heading">Editar Conductor</DialogTitle></DialogHeader>
          {editConductor && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input name="nombres" defaultValue={editConductor.nombres} required maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label>Apellido paterno</Label>
                  <Input name="apellido_paterno" defaultValue={editConductor.apellido_paterno} required maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label>Apellido materno</Label>
                  <Input name="apellido_materno" defaultValue={editConductor.apellido_materno} maxLength={80} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Correo electrónico</Label>
                  <Input value={editConductor.email} disabled className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input name="phone" defaultValue={editConductor.phone || ""} required maxLength={20} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>RUT</Label>
                  <Input name="rut" defaultValue={editConductor.rut} required maxLength={12} />
                </div>
                <div className="space-y-2">
                  <Label>Estado conductor</Label>
                  <Select name="estado_conductor" defaultValue={editConductor.estado_conductor}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADO_CONDUCTOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openDetail} onOpenChange={(open) => { if (!open) { setOpenDetail(false); setSelectedConductor(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Detalle del Conductor</DialogTitle></DialogHeader>
          {selectedConductor && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-heading font-bold text-lg">{selectedConductor.full_name}</p>
                  <Badge variant="outline" className={`mt-1 text-[10px] ${ESTADO_CONDUCTOR_STYLES[selectedConductor.estado_conductor] || ""}`}>
                    {ESTADO_CONDUCTOR_LABELS[selectedConductor.estado_conductor] || selectedConductor.estado_conductor}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Correo</p>
                  <p className="font-medium">{selectedConductor.email}</p>
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
                  <p className="text-xs text-muted-foreground">Registrado desde</p>
                  <p className="font-medium">{new Date(selectedConductor.created_at).toLocaleDateString("es-CL")}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
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
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {va.vehicles?.make} {va.vehicles?.model} ({va.vehicles?.year || "—"})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
