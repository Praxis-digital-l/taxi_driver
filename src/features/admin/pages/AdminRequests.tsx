import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge, { REQUEST_STATUSES } from "@/components/StatusBadge";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import PageHeader from "@/components/PageHeader";
import { buildRequestPriorityBreakdown, getRequestWaitingDays } from "@/lib/requestPriority";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import {
  fetchAdminRequests,
  type AdminRequest,
  updateAdminRequestStatus,
  updateRequest,
  deleteRequest,
} from "@/features/admin/services/adminRequestsService";

export default function AdminRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [reqTypes, setReqTypes] = useState<any[]>([]);
  const [filter, setFilter] = useState("pendiente");

  const [detailReq, setDetailReq] = useState<AdminRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editReq, setEditReq] = useState<AdminRequest | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteReq, setDeleteReq] = useState<AdminRequest | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminRequests(filter);
      setRequests(data);
    } catch (error) {
      toast({
        title: "Error al cargar solicitudes",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
        variant: "destructive",
      });
      setRequests([]);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase.from("request_types").select("*").order("name").then(({ data }) => setReqTypes(data || []));
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateAdminRequestStatus(id, status);
      toast({ title: `Estado actualizado a: ${status.replace("_", " ")}` });
      load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar el estado",
        variant: "destructive",
      });
    }
  };

  const openDetail = (req: AdminRequest) => {
    setDetailReq(req);
    setDetailOpen(true);
  };

  const openEdit = (req: AdminRequest) => {
    setEditReq(req);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editReq) return;
    setEditLoading(true);
    const form = new FormData(e.currentTarget);
    const amount = parseFloat(form.get("amount") as string);
    try {
      await updateRequest(editReq.id, {
        request_type_id: form.get("request_type_id") as string,
        amount: isNaN(amount) ? null : amount,
        details: (form.get("details") as string).trim(),
      });
      toast({ title: "Solicitud actualizada exitosamente" });
      setEditOpen(false);
      load();
    } catch (error) {
      toast({
        title: "Error al actualizar",
        description: error instanceof Error ? error.message : "Ocurrió un error",
        variant: "destructive",
      });
    }
    setEditLoading(false);
  };

  const confirmDelete = (req: AdminRequest) => {
    setDeleteReq(req);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteReq) return;
    setDeleteLoading(true);
    try {
      await deleteRequest(deleteReq.id);
      toast({ title: "Solicitud eliminada" });
      setDeleteOpen(false);
      if (detailReq?.id === deleteReq.id) setDetailOpen(false);
      load();
    } catch (error) {
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "Ocurrió un error",
        variant: "destructive",
      });
    }
    setDeleteLoading(false);
  };

  const prioritySummary = useMemo(
    () => buildRequestPriorityBreakdown(requests, (request) => request.request_types?.name),
    [requests],
  );

  return (
    <div>
      <PageHeader title="Gestión de Solicitudes" description={`${requests.length} resultado(s)`}>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {REQUEST_STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">{status.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {prioritySummary.length > 0 && (
        <Card className="mb-3">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Resumen de prioridad actual</p>
            <div className="flex flex-wrap gap-2">
              {prioritySummary.map((item) => (
                <span key={item.key} className="rounded-full border px-2.5 py-1 text-xs">
                  {item.summaryText}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {requests.length === 0 ? (
        <Card>
          <CardContent className="empty-state">
            <ClipboardList />
            <p>No hay solicitudes con este filtro.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => {
            const waitingDays = getRequestWaitingDays(request.created_at);

            return (
              <Card key={request.id} className="stat-card overflow-hidden cursor-pointer" onClick={() => openDetail(request)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 max-w-full overflow-hidden">
                    <div className="flex-1 min-w-0 max-w-full space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm break-words">
                          {request.profiles?.full_name ?? "Desconocido"} · {request.request_types?.name ?? "Sin tipo"}
                        </p>
                        <RequestPriorityBadge requestTypeName={request.request_types?.name} />
                      </div>
                      <p className="text-xs text-muted-foreground break-words">
                        RUT: {request.profiles?.rut ?? "—"}
                        {request.profiles?.phone ? ` · 📞 ${request.profiles.phone}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {request.vehicles?.license_plate && <span>🚗 {request.vehicles.license_plate}</span>}
                        {request.amount && <span>💰 ${Number(request.amount).toLocaleString("es-CL")}</span>}
                        <span>{new Date(request.created_at).toLocaleDateString("es-CL")}</span>
                        <span>{waitingDays} día(s) en espera</span>
                      </div>
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words">{request.details || "Sin detalles"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge status={request.status} />
                      <Select value={request.status} onValueChange={(value) => updateStatus(request.id, value)}>
                        <SelectTrigger className="w-[135px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REQUEST_STATUSES.map((status) => (
                            <SelectItem key={status} value={status} className="capitalize">
                              {status.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button onClick={() => openEdit(request)} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => confirmDelete(request)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive" /></button>
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
              {detailReq && (
                <>
                  <button onClick={() => { setDetailOpen(false); openEdit(detailReq); }} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { setDetailOpen(false); confirmDelete(detailReq); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </>
              )}
            </div>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-3 text-sm min-w-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0"><span className="text-muted-foreground">Conductor:</span><p className="font-medium truncate">{detailReq.profiles?.full_name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Tipo:</span><p className="font-medium truncate">{detailReq.request_types?.name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">RUT:</span><p className="font-medium truncate">{detailReq.profiles?.rut ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Teléfono:</span><p className="font-medium truncate">{detailReq.profiles?.phone ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Patente:</span><p className="font-medium truncate">{detailReq.vehicles?.license_plate ?? "Sin vehículo"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Monto:</span><p className="font-medium truncate">{detailReq.amount ? `$${Number(detailReq.amount).toLocaleString("es-CL")}` : "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Estado:</span><p><StatusBadge status={detailReq.status} /></p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Creado:</span><p className="font-medium truncate">{new Date(detailReq.created_at).toLocaleString("es-CL")}</p></div>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground block mb-1">Detalles:</span>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                  {detailReq.details || "Sin detalles"}
                </div>
              </div>
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
                <Label>Monto estimado (CLP)</Label>
                <Input name="amount" type="number" step="1" min="0" placeholder="Ej: 150000" defaultValue={editReq.amount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Detalles</Label>
                <Textarea name="details" required placeholder="Describe tu solicitud..." maxLength={500} defaultValue={editReq.details ?? ""} className="resize-none" />
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
              Esta acción no se puede deshacer. Se eliminará la solicitud de {deleteReq?.profiles?.full_name ?? "conductor"}.
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
