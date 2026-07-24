import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { Plus, ClipboardList, Pencil, Trash2, XCircle, CheckCircle2 } from "lucide-react";

const TERMINAL_STATUSES = ["aprobado", "rechazado", "completado"];
const FILTER_STATUSES = ["pendiente", "aprobado", "rechazado"];

function parseResolution(details: string | null) {
  if (!details) return null;
  const match = details.match(/\n\n--- MOTIVO DEL RECHAZO \(([^)]+)\) ---\n([\s\S]*)$/);
  if (!match) return null;
  return { date: match[1], reason: match[2].trim() };
}

function stripResolution(details: string | null) {
  if (!details) return "";
  return details.replace(/\n\n--- MOTIVO DEL RECHAZO .*/s, "");
}

export default function ConductorRequests() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [reqTypes, setReqTypes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [newDetails, setNewDetails] = useState("");

  const [detailReq, setDetailReq] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editReq, setEditReq] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteReq, setDeleteReq] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const location = useLocation();

  const load = async () => {
    if (!profile) return;
    const [rRes, tRes, vRes] = await Promise.all([
      supabase.from("requests").select("*, request_types(name), vehicles(license_plate)").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("request_types").select("*").order("name"),
      supabase.from("vehicle_assignments").select("vehicles(id, license_plate)").eq("profile_id", profile.id),
    ]);
    setRequests(rRes.data || []);
    setReqTypes(tRes.data || []);
    setVehicles((vRes.data || []).map((va: any) => va.vehicles));
    return rRes.data || [];
  };

  useEffect(() => { load(); }, [profile]);

  useEffect(() => {
    if (!location.state || !requests.length) return;
    const state = location.state as any;
    if (state.openRequestId) {
      const found = requests.find((r: any) => r.id === state.openRequestId);
      if (found) {
        setDetailReq(found);
        setDetailOpen(true);
      }
      window.history.replaceState({}, "");
    }
  }, [location.state, requests]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const vehicleId = form.get("vehicle_id") as string;
    const amount = parseFloat(form.get("amount") as string);

    const { error } = await supabase.from("requests").insert({
      profile_id: profile.id,
      request_type_id: form.get("request_type_id") as string,
      vehicle_id: vehicleId === "none" ? null : vehicleId,
      details: newDetails.trim(),
      amount: isNaN(amount) ? null : amount,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitud creada exitosamente" });
      setNewDetails("");
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editReq) return;
    setEditLoading(true);
    const form = new FormData(e.currentTarget);
    const amount = parseFloat(form.get("amount") as string);
    const vehicleId = form.get("vehicle_id") as string;

    const { error } = await supabase.from("requests").update({
      request_type_id: form.get("request_type_id") as string,
      vehicle_id: vehicleId === "none" ? null : vehicleId,
      amount: isNaN(amount) ? null : amount,
      details: stripResolution(form.get("details") as string),
    }).eq("id", editReq.id);

    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitud actualizada exitosamente" });
      setEditOpen(false);
      load();
    }
    setEditLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteReq) return;
    setDeleteLoading(true);
    const { error } = await supabase.from("requests").delete().eq("id", deleteReq.id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitud eliminada" });
      setDeleteOpen(false);
      if (detailReq?.id === deleteReq.id) setDetailOpen(false);
      load();
    }
    setDeleteLoading(false);
  };

  const filtered = filterStatus === "all" ? requests : requests.filter((r: any) => r.status === filterStatus);

  return (
    <div>
      <PageHeader title="Mis Solicitudes" description={`${requests.length} solicitud(es) en total`}>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {FILTER_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Nueva Solicitud</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Crear Solicitud</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de solicitud *</Label>
                <Select name="request_type_id" required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {reqTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehículo asociado</Label>
                <Select name="vehicle_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vehículo</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto estimado (CLP)</Label>
                <Input name="amount" type="number" step="1" min="0" placeholder="Ej: 150000" />
              </div>
              <div className="space-y-2">
                <Label>Detalles *</Label>
                <Textarea name="details" required placeholder="Describe tu solicitud ..." maxLength={500} value={newDetails} onChange={(e) => setNewDetails(e.target.value)} />
                <p className="text-xs text-muted-foreground text-right">{newDetails.length}/500</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Enviar Solicitud"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {filtered.length === 0 ? (
        <Card><CardContent className="empty-state"><ClipboardList /><p>No hay solicitudes con estos filtros.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((req: any) => {
            return (
              <Card key={req.id} className="stat-card cursor-pointer" onClick={() => { setDetailReq(req); setDetailOpen(true); }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 max-w-full overflow-hidden">
                    <div className="flex-1 min-w-0 max-w-full space-y-1">
                      <p className="font-medium text-sm truncate">{req.request_types?.name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <StatusBadge status={req.status} />
                        {req.amount && <span>$ {Number(req.amount).toLocaleString("es-CL")}</span>}
                        {req.vehicles?.license_plate && <span>{req.vehicles.license_plate}</span>}
                        <span>{new Date(req.created_at).toLocaleDateString("es-CL")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="font-heading">Detalle de Solicitud</DialogTitle>
            <div className="flex items-center gap-1">
              {detailReq && !TERMINAL_STATUSES.includes(detailReq.status) && (
                <>
                  <button onClick={() => { setDetailOpen(false); setEditReq(detailReq); setEditOpen(true); }} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { setDetailOpen(false); setDeleteReq(detailReq); setDeleteOpen(true); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </>
              )}
            </div>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-3 text-sm min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0"><span className="text-muted-foreground">Conductor:</span><p className="font-medium truncate">{profile?.full_name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Tipo:</span><p className="font-medium truncate">{detailReq.request_types?.name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">RUT:</span><p className="font-medium truncate">{profile?.rut ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Teléfono:</span><p className="font-medium truncate">{profile?.phone ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Patente:</span><p className="font-medium truncate">{detailReq.vehicles?.license_plate ?? "Sin vehículo"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Monto:</span><p className="font-medium truncate">{detailReq.amount ? `$${Number(detailReq.amount).toLocaleString("es-CL")}` : "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Estado:</span><p><StatusBadge status={detailReq.status} /></p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Creado:</span><p className="font-medium truncate">{new Date(detailReq.created_at).toLocaleString("es-CL")}</p></div>
                {detailReq.status !== "pendiente" && (
                  <div className="min-w-0"><span className="text-muted-foreground">Actualizado:</span><p className="font-medium truncate">{new Date(detailReq.updated_at).toLocaleString("es-CL")}</p></div>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block mb-1">Detalles de la solicitud:</span>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                  {stripResolution(detailReq.details) || "Sin detalles"}
                </div>
              </div>

              {parseResolution(detailReq.details) && (
                <div>
                  <span className="text-destructive block mb-1 font-medium flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Motivo del rechazo
                  </span>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm whitespace-pre-wrap break-all">
                    <p className="text-xs text-muted-foreground mb-1">{parseResolution(detailReq.details)?.date}</p>
                    {parseResolution(detailReq.details)?.reason}
                  </div>
                </div>
              )}

              {detailReq.status === "aprobado" && (
                <div>
                  <span className="text-green-600 block mb-1 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Aprobada
                  </span>
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Aprobada el {new Date(detailReq.updated_at).toLocaleString("es-CL")}</p>
                  </div>
                </div>
              )}

              {detailReq.status === "completado" && (
                <div>
                  <span className="text-green-600 block mb-1 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Completada
                  </span>
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Completada el {new Date(detailReq.updated_at).toLocaleString("es-CL")}</p>
                  </div>
                </div>
              )}

              {TERMINAL_STATUSES.includes(detailReq.status) && (
                <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Solicitud {detailReq.status}.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Editar Solicitud</DialogTitle></DialogHeader>
          {editReq && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de solicitud</Label>
                <Select name="request_type_id" defaultValue={editReq.request_type_id}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {reqTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehículo asociado</Label>
                <Select name="vehicle_id" defaultValue={editReq.vehicle_id ?? "none"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vehículo</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto estimado (CLP)</Label>
                <Input name="amount" type="number" step="1" min="0" placeholder="Ej: 150000" defaultValue={editReq.amount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Detalles</Label>
                <Textarea name="details" required placeholder="Describe tu solicitud..." maxLength={500} defaultValue={stripResolution(editReq.details)} className="resize-none" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={editLoading}>{editLoading ? "Guardando..." : "Guardar Cambios"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará esta solicitud de {deleteReq?.request_types?.name ?? "tipo"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive hover:bg-destructive/90">
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
