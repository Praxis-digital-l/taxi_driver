import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import StatusBadge, { REQUEST_STATUSES } from "@/components/StatusBadge";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import PageHeader from "@/components/PageHeader";
import { buildRequestPriorityBreakdown, getRequestWaitingDays } from "@/lib/requestPriority";
import { ClipboardList } from "lucide-react";
import {
  fetchAdminRequests,
  type AdminRequest,
  updateAdminRequestStatus,
} from "@/features/admin/services/adminRequestsService";

/**
 * AdminRequests — Gestión de solicitudes por estado y prioridad de negocio.
 * Orden: prioridad del tipo + antigüedad de la solicitud.
 */
export default function AdminRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [filter, setFilter] = useState("pendiente");

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
              <Card key={request.id} className="stat-card">
                <CardContent className="flex items-center gap-4 p-4 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{request.request_types?.name ?? "Sin tipo"}</p>
                      <RequestPriorityBadge requestTypeName={request.request_types?.name} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {request.profiles?.full_name}
                      {request.vehicles?.license_plate ? ` • ${request.vehicles.license_plate}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{request.details || "Sin detalles"}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {request.amount && <span>$ {Number(request.amount).toLocaleString("es-CL")}</span>}
                      <span>{new Date(request.created_at).toLocaleDateString("es-CL")}</span>
                      <span>{waitingDays} día(s) en espera</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={request.status} />
                    <Select value={request.status} onValueChange={(value) => updateStatus(request.id, value)}>
                      <SelectTrigger className="w-[145px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REQUEST_STATUSES.map((status) => (
                          <SelectItem key={status} value={status} className="capitalize">
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
