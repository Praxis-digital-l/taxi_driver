import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import RequestTypeIcon from "@/components/RequestTypeIcon";
import PageHeader from "@/components/PageHeader";
import { buildRequestPriorityBreakdown, getRequestWaitingDays, resolveRequestTypeName } from "@/lib/requestPriority";
import { supabase } from "@/integrations/supabase/client";
import { Car, CheckCircle2, ClipboardList, Pencil, Trash2, Wallet, XCircle } from "lucide-react";
import {
  fetchAdminRequests,
  type AdminRequest,
  updateAdminRequestStatus,
  resolveRequest,
  updateRequest,
  deleteRequest,
} from "@/features/admin/services/adminRequestsService";

const TERMINAL_STATUSES = ["aprobado", "rechazado", "completado"];
const FILTER_STATUSES = ["pendiente", "aprobado", "rechazado"];

function formatDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("es-CL");
}
function formatDateFull(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleString("es-CL");
}
function formatAmount(value: number | null | undefined) {
  if (value == null) return null;
  return `$${Number(value).toLocaleString("es-CL")}`;
}

export default function AdminRequests() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [reqTypes, setReqTypes] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const initialIdOpened = useRef(false);

  const [detailReq, setDetailReq] = useState<AdminRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editReq, setEditReq] = useState<AdminRequest | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editTypeId, setEditTypeId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDetails, setEditDetails] = useState("");

  const [deleteReq, setDeleteReq] = useState<AdminRequest | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [approveReq, setApproveReq] = useState<AdminRequest | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const [rejectReq, setRejectReq] = useState<AdminRequest | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

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
    if (initialIdOpened.current || requests.length === 0) return;
    const idParam = searchParams.get("id");
    if (!idParam) return;
    const match = requests.find((r) => r.id === idParam);
    if (match) {
      initialIdOpened.current = true;
      setDetailReq(match);
      setDetailOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [requests, searchParams, setSearchParams]);

  useEffect(() => {
    const initRequestTypes = async () => {
      try {
        const { data } = await supabase.from("request_types").select("*").order("name");
        const list = [...(data || [])];
        const vacType = list.find((rt) => rt.name?.toLowerCase().includes("vacacion"));

        if (!vacType) {
          const { data: created } = await supabase
            .from("request_types")
            .insert({ name: "Vacaciones" })
            .select()
            .single();

          if (created) {
            list.push(created);
            list.sort((a, b) => a.name.localeCompare(b.name));
            // Actualizar solicitudes existentes que tengan detalles de vacaciones
            await supabase
              .from("requests")
              .update({ request_type_id: created.id })
              .or("details.ilike.%[VACACIONES]%,details.ilike.%[SOLICITUD DE VACACIONES]%");
            load();
          }
        } else {
          // Si ya existe, asegurar que solicitudes previas con préstamo se corrijan a Vacaciones
          const { error: updErr } = await supabase
            .from("requests")
            .update({ request_type_id: vacType.id })
            .neq("request_type_id", vacType.id)
            .or("details.ilike.%[VACACIONES]%,details.ilike.%[SOLICITUD DE VACACIONES]%");
          if (!updErr) {
            load();
          }
        }
        setReqTypes(list);
      } catch (err) {
        console.warn("Error inicializando tipos de solicitudes:", err);
      }
    };
    initRequestTypes();
  }, []);

  const isTerminal = (status: string) => TERMINAL_STATUSES.includes(status);

  const handleApprove = async () => {
    if (!approveReq) return;
    setApproveLoading(true);
    try {
      await updateAdminRequestStatus(approveReq.id, "aprobado");
      toast({ title: "Solicitud aprobada exitosamente" });
      setApproveOpen(false);
      if (detailReq?.id === approveReq.id) {
        setDetailReq({ ...detailReq, status: "aprobado" });
      }
      load();
    } catch (error) {
      toast({
        title: "Error al aprobar",
        description: error instanceof Error ? error.message : "Ocurrió un error",
        variant: "destructive",
      });
    }
    setApproveLoading(false);
  };

  const handleReject = async () => {
    if (!rejectReq) return;
    setRejectLoading(true);
    try {
      await resolveRequest(rejectReq.id, "rechazado", rejectReason.trim());
      toast({ title: "Solicitud rechazada" });
      setRejectOpen(false);
      setRejectReason("");
      if (detailReq?.id === rejectReq.id) {
        setDetailReq({ ...detailReq, status: "rechazado" });
      }
      load();
    } catch (error) {
      toast({
        title: "Error al rechazar",
        description: error instanceof Error ? error.message : "Ocurrió un error",
        variant: "destructive",
      });
    }
    setRejectLoading(false);
  };

  const openDetail = (req: AdminRequest) => {
    setDetailReq(req);
    setDetailOpen(true);
  };

  const openEdit = (req: AdminRequest) => {
    setEditReq(req);
    setEditTypeId(req.request_type_id ?? "");
    setEditAmount(req.amount != null ? String(req.amount) : "");
    setEditDetails((req.details ?? "").replace(/\n\n--- MOTIVO DEL RECHAZO .*/s, ""));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editReq) return;
    if (!editTypeId) {
      toast({ title: "Error", description: "Selecciona un tipo de solicitud.", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    const amount = parseFloat(editAmount);
    try {
      await updateRequest(editReq.id, {
        request_type_id: editTypeId,
        amount: isNaN(amount) ? null : amount,
        details: editDetails.trim(),
        updated_at: new Date().toISOString(),
      });
      toast({ title: "Solicitud actualizada exitosamente" });
      setEditOpen(false);
      setEditReq(null);
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
      setDeleteReq(null);
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
    () => buildRequestPriorityBreakdown(requests, (request) => resolveRequestTypeName(request)),
    [requests],
  );

  const formatResolution = (details: string | null) => {
    if (!details) return null;
    const match = details.match(/\n\n--- MOTIVO DEL RECHAZO \([^)]+\) ---\n([\s\S]*)$/);
    return match ? match[1].trim() : null;
  };

  return (
    <div>
      <PageHeader title="Gestión de Solicitudes" description={`${requests.length} resultado(s)`}>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {FILTER_STATUSES.map((status) => (
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
            const typeName = resolveRequestTypeName(request);
            const canEdit = !isTerminal(request.status);

            return (
              <Card key={request.id} className="stat-card cursor-pointer overflow-hidden transition-colors hover:border-primary/40 hover:bg-muted/40" onClick={() => openDetail(request)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <RequestTypeIcon typeName={typeName} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate max-w-[60%]">{request.profiles?.full_name ?? "Desconocido"}</p>
                        <StatusBadge status={request.status} />
                        {waitingDays > 0 && (
                          <span className="text-xs text-muted-foreground">{waitingDays} día(s)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {request.profiles?.rut && <span className="text-xs text-muted-foreground">{request.profiles.rut}</span>}
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-sm font-semibold truncate">{typeName}</span>
                        <RequestPriorityBadge requestTypeName={typeName} />
                        {request.es_solicitud_especial && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Solicitud Especial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{request.details?.replace(/\n\n--- MOTIVO DEL RECHAZO .*/s, "") || "Sin detalles"}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {request.amount != null && <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" />{formatAmount(request.amount)}</span>}
                        {request.cuotas != null && <span>({request.cuotas} cuotas)</span>}
                        {request.total_con_recargo != null && <span>Total c/recargo: {formatAmount(request.total_con_recargo)}</span>}
                        {request.vehicles?.license_plate && <span className="inline-flex items-center gap-1"><Car className="h-3 w-3" />{request.vehicles.license_plate}</span>}
                        <span>{new Date(request.created_at).toLocaleDateString("es-CL")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar solicitud" onClick={() => { setDetailOpen(false); openEdit(request); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Eliminar solicitud" onClick={() => { setDetailOpen(false); confirmDelete(request); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
          <DialogHeader className="flex flex-row items-center justify-between gap-3">
            <DialogTitle className="font-heading">Detalle de Solicitud</DialogTitle>
            <div className="flex items-center gap-1">
              {detailReq && (
                <>
                  {!isTerminal(detailReq.status) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar solicitud" onClick={() => { setDetailOpen(false); openEdit(detailReq); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Eliminar solicitud" onClick={() => { setDetailOpen(false); confirmDelete(detailReq); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-3 text-sm min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0"><span className="text-muted-foreground">Conductor:</span><p className="font-medium truncate">{detailReq.profiles?.full_name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Tipo:</span><p className="font-medium truncate text-primary font-semibold">{resolveRequestTypeName(detailReq)}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">RUT:</span><p className="font-medium truncate">{detailReq.profiles?.rut ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Teléfono:</span><p className="font-medium truncate">{detailReq.profiles?.phone ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Patente:</span><p className="font-medium truncate">{detailReq.vehicles?.license_plate ?? "Sin vehículo"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Monto Solicitado:</span><p className="font-medium truncate">{detailReq.amount ? formatAmount(detailReq.amount) : "—"}</p></div>
                {detailReq.cuotas != null && (
                  <div className="min-w-0"><span className="text-muted-foreground">Cuotas:</span><p className="font-medium truncate">{detailReq.cuotas} cuota(s){detailReq.total_con_recargo ? ` de ${formatAmount(Math.round(detailReq.total_con_recargo / detailReq.cuotas))}` : ""}</p></div>
                )}
                {detailReq.recargo_porcentaje != null && (
                  <div className="min-w-0"><span className="text-muted-foreground">Recargo:</span><p className="font-medium truncate text-amber-600 dark:text-amber-400">{detailReq.recargo_porcentaje}%</p></div>
                )}
                {detailReq.total_con_recargo != null && (
                  <div className="min-w-0"><span className="text-muted-foreground">Total c/recargo:</span><p className="font-semibold text-primary truncate">{formatAmount(detailReq.total_con_recargo)}</p></div>
                )}
                {detailReq.es_solicitud_especial && (
                  <div className="min-w-0"><span className="text-muted-foreground">Categoría:</span><p className="font-medium text-purple-600 dark:text-purple-400 truncate">⭐ Solicitud Especial (Conductor Antiguo)</p></div>
                )}
                <div className="min-w-0"><span className="text-muted-foreground">Estado:</span><p className="flex items-center gap-2"><StatusBadge status={detailReq.status} />{detailReq.status === "aprobado" && (() => { const d = formatDateOnly(detailReq.updated_at); return d ? <span className="text-xs text-muted-foreground">· {d}</span> : null; })()}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Creado:</span><p className="font-medium truncate">{formatDateFull(detailReq.created_at)}</p></div>
                {detailReq.status !== "pendiente" && (
                  <div className="min-w-0"><span className="text-muted-foreground">Actualizado:</span><p className="font-medium truncate">{formatDateFull(detailReq.updated_at) ?? "—"}</p></div>
                )}
              </div>

              <div className="min-w-0">
                <span className="text-muted-foreground block mb-1">Detalles de la solicitud:</span>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                  {detailReq.details?.replace(/\n\n--- MOTIVO DEL RECHAZO .*/s, "") || "Sin detalles"}
                </div>
              </div>

              {formatResolution(detailReq.details) && (
                <div className="min-w-0">
                  <span className="text-destructive block mb-1 font-medium">Motivo del rechazo:</span>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm whitespace-pre-wrap break-all">
                    {formatResolution(detailReq.details)}
                  </div>
                </div>
              )}

              {detailReq.status === "aprobado" && (
                <div className="min-w-0">
                  <span className="text-green-600 block mb-1 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Aprobado
                  </span>
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDateOnly(detailReq.updated_at) ? `Fecha de aprobación: ${formatDateOnly(detailReq.updated_at)}` : "Fecha de aprobación: —"}</p>
                  </div>
                </div>
              )}

              {!isTerminal(detailReq.status) && (
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => { setDetailOpen(false); setApproveReq(detailReq); setApproveOpen(true); }}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprobar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => { setDetailOpen(false); setRejectReq(detailReq); setRejectOpen(true); }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Rechazar
                  </Button>
                </div>
              )}

              {isTerminal(detailReq.status) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground text-center">Solicitud {detailReq.status} — no se pueden cambiar estados.</p>
                </div>
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
                <Label>Tipo de solicitud *</Label>
                <Select value={editTypeId} onValueChange={setEditTypeId} required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {reqTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto estimado (CLP)</Label>
                <Input type="number" step="1" min="0" placeholder="Ej: 150000" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Detalles *</Label>
                <Textarea required placeholder="Describe tu solicitud..." maxLength={500} value={editDetails} onChange={(e) => setEditDetails(e.target.value)} className="resize-none" />
                <p className="text-xs text-muted-foreground text-right">{editDetails.length}/500</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={editLoading}>{editLoading ? "Guardando..." : "Guardar Cambios"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se confirmará la solicitud de {approveReq?.profiles?.full_name ?? "conductor"} como aprobada.
              {approveReq && <p className="mt-2 text-xs text-muted-foreground">Fecha: {new Date().toLocaleString("es-CL")}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveLoading}>
              {approveLoading ? "Aprobando..." : "Sí, aprobar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={rejectOpen} onOpenChange={(open) => { if (!open) setRejectReason(""); setRejectOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo del rechazo. El conductor podrá ver esta información.
              <p className="mt-2 text-xs text-muted-foreground">Fecha: {new Date().toLocaleString("es-CL")}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Label htmlFor="reject-reason">Motivo del rechazo *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ej: No hay presupuesto disponible este mes..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1.5 resize-none"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectLoading || !rejectReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rejectLoading ? "Rechazando..." : "Sí, rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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