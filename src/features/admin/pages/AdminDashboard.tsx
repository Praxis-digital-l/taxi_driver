import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import { Plate } from "@/components/ui/plate";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getRequestWaitingDays } from "@/lib/requestPriority";
import {
  Truck,
  Users,
  ClipboardList,
  FileText,
  Search,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  fetchAdminDashboardData,
  type AdminDashboardStats,
  type AdminExpiringDocument,
  type AdminDashboardUnreadMessage,
} from "@/features/admin/services/adminDashboardService";
import {
  INSURANCE_TYPE_LABEL,
  getInsuranceDaysLeft,
  type AdminExpiringInsurance,
} from "@/features/admin/services/adminInsuranceService";
import type { AdminRequest } from "@/features/admin/services/adminRequestsService";
import { ConductorDelMesCard } from "@/components/ConductorDelMesCard";

const EMPTY_STATS: AdminDashboardStats = {
  vehicles: 0,
  activeVehicles: 0,
  conductors: 0,
  pendingRequests: 0,
  inProcessRequests: 0,
  expiringDocs: 0,
  totalDocs: 0,
  unreadMessages: 0,
  expiringInsurances: 0,
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [recentRequests, setRecentRequests] = useState<AdminRequest[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<AdminExpiringDocument[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<AdminDashboardUnreadMessage[]>([]);
  const [expiringInsurances, setExpiringInsurances] = useState<AdminExpiringInsurance[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const dashboard = await fetchAdminDashboardData();
        setStats(dashboard.stats);
        setRecentRequests(dashboard.activeRequests);
        setExpiringDocs(dashboard.expiringDocuments);
        setUnreadMessages(dashboard.unreadMessages);
        setExpiringInsurances(dashboard.expiringInsurances);
      } catch (error) {
        toast({
          title: "Error al cargar dashboard",
          description: error instanceof Error ? error.message : "No fue posible cargar los datos",
          variant: "destructive",
        });
      }
    };

    load();
  }, [toast]);

  const hasPending = stats.pendingRequests > 0 || stats.expiringDocs > 0 || stats.unreadMessages > 0 || stats.expiringInsurances > 0;

  const hoy = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const boardTiles = [
    { icon: Truck, label: "flota activa", value: `${stats.activeVehicles}/${stats.vehicles}`, to: "/admin/vehicles" },
    { icon: Users, label: "conductores registrados", value: String(stats.conductors), to: "/admin/conductores" },
    { icon: ClipboardList, label: "solicitudes activas", value: String(stats.pendingRequests + stats.inProcessRequests), to: "/admin/requests" },
    { icon: FileText, label: "documentos por vencer", value: String(stats.expiringDocs), to: "/admin/documents" },
    { icon: ShieldCheck, label: "seguros por vencer", value: String(stats.expiringInsurances), to: "/admin/search" },
    { icon: MessageSquare, label: "mensajes sin respuesta", value: String(stats.unreadMessages), to: "/admin/messages" },
  ];

  const pendingItems = useMemo(() => {
    const items: {
      id: string;
      type: "request" | "document" | "message" | "insurance";
      title: string;
      subtitle: string;
      plate?: string | null;
      meta: string;
      priorityName?: string | null;
      status: string;
      link: string;
    }[] = [];

    for (const r of recentRequests) {
      items.push({
        id: r.id,
        type: "request",
        title: r.request_types?.name ?? "Solicitud",
        subtitle: r.profiles?.full_name ?? "Sin conductor",
        plate: r.vehicles?.license_plate ?? null,
        meta: `${getRequestWaitingDays(r.created_at)} día(s) en espera`,
        priorityName: r.request_types?.name,
        status: r.status,
        link: `/admin/requests?id=${r.id}`,
      });
    }

    for (const d of expiringDocs) {
      const daysLeft = Math.ceil((new Date(d.expiration_date).getTime() - Date.now()) / 86400000);
      items.push({
        id: d.id,
        type: "document",
        title: d.document_types?.name ?? "Documento",
        subtitle: d.profiles?.full_name ?? "Sin conductor",
        plate: d.vehicles?.license_plate ?? null,
        meta: `${daysLeft} día(s)`,
        priorityName: null,
        status: daysLeft <= 7 ? "urgent" : "warning",
        link: "/admin/documents",
      });
    }

    for (const m of unreadMessages) {
      const daysAgo = Math.ceil((Date.now() - new Date(m.created_at).getTime()) / 86400000);
      items.push({
        id: m.id,
        type: "message",
        title: `Mensaje de ${m.sender?.full_name ?? "desconocido"}`,
        subtitle: m.content.length > 80 ? `${m.content.slice(0, 80)}…` : m.content,
        plate: null,
        meta: `hace ${daysAgo} día(s)`,
        priorityName: null,
        status: "pendiente",
        link: "/admin/messages",
      });
    }

    for (const ins of expiringInsurances) {
      const daysLeft = getInsuranceDaysLeft(ins.expiration_date);
      items.push({
        id: ins.id,
        type: "insurance",
        title: `Seguro: ${INSURANCE_TYPE_LABEL[ins.insurance_type] ?? ins.insurance_type}`,
        subtitle: `$ ${Number(ins.amount).toLocaleString("es-CL")}`,
        plate: ins.vehicles?.license_plate ?? null,
        meta: `${daysLeft} día(s)`,
        priorityName: null,
        status: daysLeft <= 7 ? "urgent" : "warning",
        link: ins.vehicles?.license_plate
          ? `/admin/search?plate=${encodeURIComponent(ins.vehicles.license_plate)}`
          : "/admin/search",
      });
    }

    return items;
  }, [recentRequests, expiringDocs, unreadMessages, expiringInsurances]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl bg-board text-board-foreground shadow-md animate-fade-in">
        <span className="absolute inset-y-0 left-0 w-1 bg-board-primary" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-board-primary/15 blur-3xl"
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1.5">
              <p className="font-data text-[9px] uppercase tracking-[0.3em] text-board-primary">
                Atención del turno
              </p>
              <h3 className="font-heading text-xl font-semibold tracking-wide text-board-accent-foreground">
                Resumen del turno
              </h3>
              <p className="max-w-2xl text-sm text-board-foreground/70">
                {hasPending
                  ? "Lo que hoy necesita salir a tiempo: antes de abrir la calle, revisa lo que quedó en espera."
                  : "Todo en orden para arrancar el turno; sin pendientes urgentes."}
              </p>
            </div>

            <p className="font-data text-xs uppercase tracking-widest text-board-foreground/60 capitalize">
              {hoy}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {boardTiles.map(({ icon: Icon, label, value, to }) => (
              <Link
                key={label}
                to={to}
                aria-label={`${label}: ${value}`}
                className="group rounded-md border border-board-border bg-board-accent/70 px-4 py-3 transition-colors hover:border-board-primary/60 hover:bg-board-accent"
              >
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-board-accent-foreground/90">
                  <Icon className="h-3.5 w-3.5 text-board-foreground/50 group-hover:text-board-primary" />
                  {label}
                </span>
                <p className="mt-2 font-data text-2xl font-medium leading-none tabular-nums text-board-primary">
                  {value}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ConductorDelMesCard editable />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Acceso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: "/admin/search", icon: Search, label: "Buscar por Patente", desc: "Info consolidada", color: "text-primary" },
              { to: "/admin/vehicles", icon: Truck, label: "Gestión de Vehículos", desc: `${stats.vehicles} en flota`, color: "text-accent" },
              { to: "/admin/requests", icon: ClipboardList, label: "Solicitudes", desc: `${stats.pendingRequests} pendientes`, color: "text-warning" },
              { to: "/admin/messages", icon: MessageSquare, label: "Mensajes", desc: `${stats.unreadMessages} sin respuesta`, color: "text-info" },
            ].map(({ to, icon: Icon, label, desc, color }) => (
              <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors group">
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{label}</span>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-base">Pendientes</CardTitle>
            <Link to="/admin/requests" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver solicitudes <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {pendingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay tareas pendientes.</p>
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    to={item.link}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap gap-y-1">
                        {item.type === "request" && <ClipboardList className="h-4 w-4 text-warning shrink-0" />}
                        {item.type === "document" && <FileText className="h-4 w-4 text-destructive shrink-0" />}
                        {item.type === "insurance" && <ShieldCheck className="h-4 w-4 text-warning shrink-0" />}
                        {item.type === "message" && <MessageSquare className="h-4 w-4 text-info shrink-0" />}
                        <p className="text-sm font-medium break-all">{item.title}</p>
                        {item.type === "request" && item.priorityName && (
                          <RequestPriorityBadge requestTypeName={item.priorityName} className="text-[10px]" />
                        )}
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-muted-foreground">
                        <span className="break-all">{item.subtitle}</span>
                        {item.plate && <Plate licensePlate={item.plate} className="shrink-0" />}
                      </p>
                      <p className="mt-1 font-data text-[10px] text-muted-foreground">{item.meta}</p>
                    </div>
                    {item.type === "document" || item.type === "insurance" ? (
                      <span className={`shrink-0 text-xs font-medium ${item.status === "urgent" ? "text-destructive" : "text-warning"}`}>
                        {item.meta}
                      </span>
                    ) : (
                      <StatusBadge status={item.status} />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
