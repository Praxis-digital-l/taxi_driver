import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Search } from "lucide-react";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import StatusBadge, { REQUEST_STATUSES } from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizeRequestTypeName, sortRequestsByPriority } from "@/lib/requestPriority";

const REQUEST_STATUS_FILTERS = [
  { value: "active", label: "Activas" },
  { value: "all", label: "Todas" },
  ...REQUEST_STATUSES.map((status) => ({
    value: status,
    label: status.replace("_", " "),
  })),
];

function sanitizeStatusFilter(value: string | null) {
  return REQUEST_STATUS_FILTERS.some((option) => option.value === value) ? value! : "pendiente";
}

export default function AdminRequests() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<any[]>([]);
  const filter = sanitizeStatusFilter(searchParams.get("status"));
  const typeFilter = searchParams.get("type")?.trim() ?? "";
  const search = searchParams.get("q") ?? "";
  const backTarget = typeof location.state?.from === "string" ? location.state.from : "/admin";

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }

      next.set(key, value);
    });

    setSearchParams(next);
  };

  const handleBack = () => {
    navigate(backTarget);
  };

  const load = async () => {
    let query = supabase
      .from("requests")
      .select("*, request_types(name), profiles(full_name), vehicles(license_plate)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter === "active") {
      query = query.in("status", ["pendiente", "en_proceso"]);
    } else if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setRequests(data || []);
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("requests").update({ status }).eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `Estado actualizado: ${status.replace("_", " ")}` });
    void load();
  };

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const normalizedTypeFilter = normalizeRequestTypeName(typeFilter);
    const requestsByType = normalizedTypeFilter
      ? requests.filter(
          (request: any) => normalizeRequestTypeName(request.request_types?.name) === normalizedTypeFilter,
        )
      : requests;
    const visibleRequests = searchTerm
      ? requestsByType.filter((request: any) =>
          (request.profiles?.full_name || "").toLowerCase().includes(searchTerm) ||
          (request.vehicles?.license_plate || "").toLowerCase().includes(searchTerm) ||
          (request.details || "").toLowerCase().includes(searchTerm) ||
          (request.request_types?.name || "").toLowerCase().includes(searchTerm),
        )
      : requestsByType;

    return sortRequestsByPriority(
      visibleRequests,
      (request) => request.request_types?.name,
      (request) => request.created_at,
    );
  }, [requests, search, typeFilter]);

  return (
    <div>
      <PageHeader title="Gestion de Solicitudes" description={`${filtered.length} resultado(s)`}>
        <Button type="button" variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conductor, patente o tipo..."
            value={search}
            onChange={(e) => updateSearchParams({ q: e.target.value || null })}
            className="h-8 w-[220px] pl-8 text-xs"
          />
        </div>
        <Select value={filter} onValueChange={(value) => updateSearchParams({ status: value === "pendiente" ? null : value })}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_STATUS_FILTERS.map((status) => (
              <SelectItem key={status.value} value={status.value} className="capitalize">
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {typeFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrado por tipo:</span>
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {typeFilter}
          </span>
          <button
            type="button"
            onClick={() => updateSearchParams({ type: null })}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpiar filtro
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="empty-state">
            <ClipboardList />
            <p>No hay solicitudes con estos filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((request: any) => (
            <Card key={request.id} className={`stat-card ${request.status === "pendiente" ? "border-warning/20" : ""}`}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{request.request_types?.name}</p>
                    <RequestPriorityBadge requestTypeName={request.request_types?.name} />
                    {request.amount && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        ${Number(request.amount).toLocaleString("es-CL")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {request.profiles?.full_name}
                    {request.vehicles?.license_plate ? ` • ${request.vehicles.license_plate}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{request.details || "Sin detalles"}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(request.created_at).toLocaleDateString("es-CL", { dateStyle: "medium" })}
                  </p>
                </div>
                <StatusBadge status={request.status} />
                <Select value={request.status} onValueChange={(value) => updateStatus(request.id, value)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
