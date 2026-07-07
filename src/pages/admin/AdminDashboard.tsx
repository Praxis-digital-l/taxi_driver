import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  DollarSign,
  FileText,
  MessageSquare,
  Search,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import FuelConsumptionChart from "@/components/admin/FuelConsumptionChart";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { buildMonthlyFuelConsumption, type MonthlyFuelConsumption } from "@/lib/fuelConsumption";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    vehicles: 0,
    activeVehicles: 0,
    conductors: 0,
    pendingRequests: 0,
    inProcessRequests: 0,
    expiringDocs: 0,
    totalDocs: 0,
    unreadMessages: 0,
    totalRequests: 0,
    approvedThisMonth: 0,
  });
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<any[]>([]);
  const [fuelConsumptionData, setFuelConsumptionData] = useState<MonthlyFuelConsumption[]>(() =>
    buildMonthlyFuelConsumption([], 6),
  );

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const firstFuelMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      const [
        vehiclesRes,
        activeVehiclesRes,
        conductorsRes,
        pendingCountRes,
        inProcessCountRes,
        expiringCountRes,
        totalDocsRes,
        messagesRes,
        activeRequestsRes,
        fuelRequestsRes,
        expiringDocsRes,
        totalRequestsRes,
        approvedThisMonthRes,
      ] = await Promise.all([
        supabase.from("vehicles").select("id", { count: "exact" }),
        supabase.from("vehicles").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "conductor"),
        supabase.from("requests").select("id", { count: "exact" }).eq("status", "pendiente"),
        supabase.from("requests").select("id", { count: "exact" }).eq("status", "en_proceso"),
        supabase.from("documents").select("id", { count: "exact" }).lte("expiration_date", thirtyDays).gte("expiration_date", today),
        supabase.from("documents").select("id", { count: "exact" }),
        supabase.from("messages").select("id", { count: "exact" }).eq("status", "pendiente"),
        supabase
          .from("requests")
          .select("*, request_types(name), profiles(full_name), vehicles(license_plate)")
          .in("status", ["pendiente", "en_proceso"])
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("requests")
          .select("created_at, amount, request_types(name)")
          .gte("created_at", firstFuelMonth)
          .order("created_at", { ascending: true })
          .limit(500),
        supabase
          .from("documents")
          .select("*, document_types(name), profiles(full_name), vehicles(license_plate)")
          .lte("expiration_date", thirtyDays)
          .gte("expiration_date", today)
          .order("expiration_date", { ascending: true })
          .limit(5),
        supabase.from("requests").select("id", { count: "exact" }),
        supabase.from("requests").select("id", { count: "exact" }).eq("status", "aprobado").gte("updated_at", monthStart),
      ]);

      setStats({
        vehicles: vehiclesRes.count || 0,
        activeVehicles: activeVehiclesRes.count || 0,
        conductors: conductorsRes.count || 0,
        pendingRequests: pendingCountRes.count || 0,
        inProcessRequests: inProcessCountRes.count || 0,
        expiringDocs: expiringCountRes.count || 0,
        totalDocs: totalDocsRes.count || 0,
        unreadMessages: messagesRes.count || 0,
        totalRequests: totalRequestsRes.count || 0,
        approvedThisMonth: approvedThisMonthRes.count || 0,
      });
      setActiveRequests(activeRequestsRes.data || []);
      setFuelConsumptionData(buildMonthlyFuelConsumption(fuelRequestsRes.data || [], 6, now));
      setExpiringDocs(expiringDocsRes.data || []);
    };

    void load();
  }, []);

  const hasPending =
    stats.pendingRequests > 0 || stats.inProcessRequests > 0 || stats.expiringDocs > 0 || stats.unreadMessages > 0;

  const sortedActiveRequests = useMemo(
    () =>
      [...activeRequests].sort(
        (left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime(),
      ),
    [activeRequests],
  );

  const topMetrics = [
    {
      to: "/admin/vehicles",
      icon: Truck,
      label: "Flota Activa",
      value: `${stats.activeVehicles}/${stats.vehicles}`,
      sub: "vehiculos activos",
      color: "bg-primary/10 text-primary",
    },
    {
      to: "/admin/vehicles",
      icon: Users,
      label: "Conductores",
      value: stats.conductors,
      sub: "registrados",
      color: "bg-accent/10 text-accent",
    },
  ];

  const priorityBannerItems = [
    {
      key: "pending",
      to: "/admin/requests?status=pendiente",
      icon: ClipboardList,
      label: "Solicitudes pendientes",
      value: stats.pendingRequests,
      detail: "Revision inicial",
      color: "border-warning/30 bg-warning/10 text-warning",
    },
    {
      key: "in_process",
      to: "/admin/requests?status=en_proceso",
      icon: ArrowRight,
      label: "Solicitudes en proceso",
      value: stats.inProcessRequests,
      detail: "Seguimiento activo",
      color: "border-info/30 bg-info/10 text-info",
    },
    {
      key: "docs",
      to: "/admin/search",
      icon: FileText,
      label: "Documentos por vencer",
      value: stats.expiringDocs,
      detail: "Proximos 30 dias",
      color: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    {
      key: "messages",
      to: "/admin/messages",
      icon: MessageSquare,
      label: "Mensajes sin respuesta",
      value: stats.unreadMessages,
      detail: "Contactos pendientes",
      color: "border-primary/30 bg-primary/10 text-primary",
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {hasPending && (
        <div className="animate-fade-in overflow-hidden rounded-2xl border border-warning/30 bg-gradient-to-r from-warning/10 via-background to-primary/5 shadow-sm">
          <div className="relative p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_65%)] lg:block" />

            <div className="relative flex flex-col gap-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-background/80 px-3 py-1 text-xs font-medium text-warning shadow-sm">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Centro de atencion inmediata
                  </div>
                  <div>
                    <h3 className="font-heading text-xl font-bold tracking-tight">Gestiona primero lo que necesita accion hoy</h3>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      El cliente puede entrar aqui y saltar directo a solicitudes, documentos o mensajes pendientes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-warning/30 bg-background/80 px-3 py-1 text-xs shadow-sm">
                    <span className="font-semibold text-foreground">{stats.pendingRequests + stats.inProcessRequests}</span>
                    <span className="ml-1 text-muted-foreground">solicitudes activas</span>
                  </div>
                  <div className="rounded-full border border-destructive/30 bg-background/80 px-3 py-1 text-xs shadow-sm">
                    <span className="font-semibold text-foreground">{stats.expiringDocs}</span>
                    <span className="ml-1 text-muted-foreground">docs por vencer</span>
                  </div>
                  <div className="rounded-full border border-primary/30 bg-background/80 px-3 py-1 text-xs shadow-sm">
                    <span className="font-semibold text-foreground">{stats.unreadMessages}</span>
                    <span className="ml-1 text-muted-foreground">mensajes sin respuesta</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {priorityBannerItems.map(({ key, to, icon: Icon, label, value, detail, color }) => (
                  <Link
                    key={key}
                    to={to}
                    state={{ from: "/admin" }}
                    className="group rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {topMetrics.map(({ to, icon: Icon, label, value, sub, color }) => (
          <Link key={label} to={to} className="group block">
            <Card className="stat-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="font-heading text-xl font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{sub}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[ 
          { icon: DollarSign, label: "Aprobadas este mes", value: stats.approvedThisMonth, color: "text-accent" },
          { icon: Wrench, label: "Total Solicitudes", value: stats.totalRequests, color: "text-muted-foreground" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="stat-card">
            <CardContent className="flex items-center gap-3 p-3">
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              <div>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="font-heading text-lg font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FuelConsumptionChart data={fuelConsumptionData} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Acceso Rapido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: "/admin/search", icon: Search, label: "Buscar por Patente", desc: "Info consolidada por vehiculo", color: "text-primary" },
              { to: "/admin/vehicles", icon: Truck, label: "Gestion de Vehiculos", desc: `${stats.vehicles} en flota`, color: "text-accent" },
              { to: "/admin/requests", icon: ClipboardList, label: "Solicitudes", desc: `${stats.pendingRequests} pendientes`, color: "text-warning" },
              { to: "/admin/messages", icon: MessageSquare, label: "Mensajes", desc: `${stats.unreadMessages} sin respuesta`, color: "text-info" },
            ].map(({ to, icon: Icon, label, desc, color }) => (
              <Link key={to} to={to} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{label}</span>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-base">Solicitudes Activas</CardTitle>
            <Link to="/admin/requests" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {sortedActiveRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay solicitudes activas.</p>
            ) : (
              <div className="space-y-2">
                {sortedActiveRequests.slice(0, 8).map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{request.request_types?.name}</p>
                        <RequestPriorityBadge requestTypeName={request.request_types?.name} />
                        {request.amount && (
                          <span className="text-[10px] text-muted-foreground">
                            ${Number(request.amount).toLocaleString("es-CL")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {request.profiles?.full_name}
                        {request.vehicles?.license_plate ? ` • ${request.vehicles.license_plate}` : ""}
                        {` • ${new Date(request.created_at).toLocaleDateString("es-CL")}`}
                      </p>
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
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Documentos Proximos a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringDocs.map((doc: any) => {
                const daysLeft = Math.ceil((new Date(doc.expiration_date).getTime() - Date.now()) / 86400000);

                return (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{doc.document_types?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.profiles?.full_name}
                        {doc.vehicles?.license_plate ? ` • ${doc.vehicles.license_plate}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${daysLeft <= 7 ? "text-destructive" : "text-warning"}`}>
                      {daysLeft} dia(s)
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
