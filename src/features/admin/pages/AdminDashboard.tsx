import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getRequestWaitingDays } from "@/lib/requestPriority";
import {
  Truck,
  Users,
  ClipboardList,
  FileText,
  AlertTriangle,
  Search,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import {
  fetchAdminDashboardData,
  type AdminDashboardStats,
  type AdminExpiringDocument,
} from "@/features/admin/services/adminDashboardService";
import type { AdminRequest } from "@/features/admin/services/adminRequestsService";

type MetricCardConfig = {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: typeof Truck;
  to: string;
};

const EMPTY_STATS: AdminDashboardStats = {
  vehicles: 0,
  activeVehicles: 0,
  conductors: 0,
  pendingRequests: 0,
  inProcessRequests: 0,
  expiringDocs: 0,
  totalDocs: 0,
  unreadMessages: 0,
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [recentRequests, setRecentRequests] = useState<AdminRequest[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<AdminExpiringDocument[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const dashboard = await fetchAdminDashboardData();
        setStats(dashboard.stats);
        setRecentRequests(dashboard.activeRequests);
        setExpiringDocs(dashboard.expiringDocuments);
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

  const hasPending = stats.pendingRequests > 0 || stats.expiringDocs > 0 || stats.unreadMessages > 0;

  const metricCards: MetricCardConfig[] = [
    {
      icon: Truck,
      label: "Flota Total",
      value: `${stats.activeVehicles}/${stats.vehicles}`,
      sub: "activos",
      color: "bg-primary/10 text-primary",
      to: "/admin/vehicles",
    },
    {
      icon: Users,
      label: "Conductores",
      value: stats.conductors,
      sub: "registrados",
      color: "bg-accent/10 text-accent",
      to: isSuperAdmin ? "/admin/users" : "/admin/vehicles",
    },
    {
      icon: ClipboardList,
      label: "Solicitudes",
      value: stats.pendingRequests,
      sub: "pendientes",
      color: "bg-warning/10 text-warning",
      to: "/admin/requests",
    },
    {
      icon: FileText,
      label: "Docs por Vencer",
      value: stats.expiringDocs,
      sub: "en 30 días",
      color: "bg-destructive/10 text-destructive",
      to: "/admin/search",
    },
  ];

  return (
    <div className="space-y-6">
      {hasPending && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 animate-fade-in">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Existen tareas pendientes</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingRequests > 0 && `${stats.pendingRequests} solicitud(es) pendiente(s). `}
              {stats.inProcessRequests > 0 && `${stats.inProcessRequests} en proceso. `}
              {stats.expiringDocs > 0 && `${stats.expiringDocs} documento(s) por vencer. `}
              {stats.unreadMessages > 0 && `${stats.unreadMessages} mensaje(s) pendiente(s).`}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {metricCards.map(({ icon: Icon, label, value, sub, color, to }) => (
          <Link key={label} to={to} className="block group">
            <Card className="stat-card transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:border-primary/20">
              <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold font-heading">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

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
            <CardTitle className="font-heading text-base">Solicitudes Activas</CardTitle>
            <Link to="/admin/requests" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay solicitudes activas.</p>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{request.request_types?.name}</p>
                        <RequestPriorityBadge requestTypeName={request.request_types?.name} className="text-[10px]" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {request.profiles?.full_name} {request.vehicles?.license_plate ? `• ${request.vehicles.license_plate}` : ""}
                        {` • ${new Date(request.created_at).toLocaleDateString("es-CL")}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{getRequestWaitingDays(request.created_at)} día(s) en espera</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {expiringDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Documentos Próximos a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringDocs.map((document) => {
                const daysLeft = Math.ceil((new Date(document.expiration_date).getTime() - Date.now()) / 86400000);

                return (
                  <div key={document.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{document.document_types?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.profiles?.full_name} {document.vehicles?.license_plate ? `• ${document.vehicles.license_plate}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-destructive" : "text-warning"}`}>
                      {daysLeft} día(s)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
