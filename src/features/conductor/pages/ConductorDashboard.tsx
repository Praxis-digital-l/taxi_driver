import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { Truck, FileText, ClipboardList, AlertTriangle, Gauge, Star, MessageSquare, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PhotoUploadCard } from "@/features/conductor/components/PhotoUploadCard";
import { ConductorDelMesCard } from "@/components/ConductorDelMesCard";
import ConductorVacationsCard from "@/features/conductor/components/ConductorVacationsCard";
import { resolveRequestTypeName } from "@/lib/requestPriority";
import { requiresExpirationDate } from "@/lib/documentRules";

export default function ConductorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    vehicles: 0, documents: 0, pendingRequests: 0,
    totalRequests: 0, pendingMessages: 0, lastMileage: 0,
    expiringDocs: 0,
  });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      const [vRes, dRes, rRes, mRes, msgRes, expRes] = await Promise.all([
        supabase.from("vehicle_assignments").select("id", { count: "exact" }).eq("profile_id", profile.id),
        supabase.from("documents").select("id", { count: "exact" }).eq("profile_id", profile.id),
        supabase.from("requests").select("*, request_types(name)").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("mileage_records").select("kilometers").eq("profile_id", profile.id).order("recorded_date", { ascending: false }).order("created_at", { ascending: false }).limit(1),
        supabase.from("messages").select("id", { count: "exact" }).eq("receiver_id", profile.id).eq("status", "enviado").is("read_at", null),
        supabase.from("documents").select("id, document_types(name)").eq("profile_id", profile.id).lte("expiration_date", thirtyDays).gte("expiration_date", now.toISOString().slice(0, 10)),
      ]);

      const pendingReqs = (rRes.data || []).filter((r: any) => r.status === "pendiente" || r.status === "en_proceso");
      setRecentRequests(rRes.data || []);
      const expiringCount = ((expRes.data as any[]) || []).filter((d: any) => requiresExpirationDate(d.document_types?.name)).length;
      setHasPending(pendingReqs.length > 0 || (msgRes.count || 0) > 0 || expiringCount > 0);
      setStats({
        vehicles: vRes.count || 0,
        documents: dRes.count || 0,
        pendingRequests: pendingReqs.length,
        totalRequests: (rRes.data || []).length,
        pendingMessages: msgRes.count || 0,
        lastMileage: mRes.data?.[0]?.kilometers || 0,
        expiringDocs: expiringCount,
      });
    };
    load();
  }, [profile]);

  const userName = profile?.full_name || [profile?.nombres, profile?.apellido_paterno].filter(Boolean).join(" ") || "Conductor";

  return (
    <div className="space-y-6">
      {/* Saludo principal */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">
          Hola de nuevo, {userName}
        </h2>
        <p className="text-muted-foreground text-sm">
          Este es el resumen de tu cuenta y estado operativo.
        </p>
      </div>

      {/* Alerta principal de tareas pendientes */}
      {hasPending && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Existen tareas pendientes</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingRequests > 0 && `${stats.pendingRequests} solicitud(es) sin cerrar. `}
              {stats.pendingMessages > 0 && `${stats.pendingMessages} mensaje(s) no leídos. `}
              {stats.expiringDocs > 0 && `${stats.expiringDocs} documento(s) por vencer en 30 días.`}
            </p>
          </div>
        </div>
      )}

      {/* Fila superior: Perfil de conductor + Conductor del Mes */}
      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        <PhotoUploadCard className="h-full" />
        <div className="lg:col-span-2">
          <ConductorDelMesCard className="h-full" />
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          { icon: Truck, label: "Vehículos Asignados", value: stats.vehicles, to: "/conductor/vehicles", color: "bg-primary/10 text-primary" },
          { icon: FileText, label: "Documentos", value: stats.documents, to: "/conductor/documents", color: "bg-accent/10 text-accent" },
          { icon: ClipboardList, label: "Solicitudes Pendientes", value: stats.pendingRequests, to: "/conductor/requests", color: "bg-warning/10 text-warning" },
          { icon: Gauge, label: "Último Kilometraje", value: stats.lastMileage > 0 ? `${stats.lastMileage.toLocaleString("es-CL")} km` : "—", to: "/conductor/mileage", color: "bg-info/10 text-info" },
          { icon: Star, label: "Mi Puntuación", value: profile?.score != null ? `${profile.score}/10` : "—", to: null, color: "bg-warning/10 text-warning" },
        ].map(({ icon: Icon, label, value, to, color }) => {
          const cardContent = (
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-xl font-bold font-heading">{value}</p>
              </div>
            </CardContent>
          );
          return to ? (
            <Link key={label} to={to}>
              <Card className="stat-card group cursor-pointer hover:border-primary/30">{cardContent}</Card>
            </Link>
          ) : (
            <Card key={label} className="stat-card">{cardContent}</Card>
          );
        })}
      </div>

      {/* Reorganización: Columna izquierda (Solicitudes Recientes) y Columna derecha (Registro de Vacaciones) */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Columna Izquierda: Solicitudes recientes */}
        <div className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20 border-b">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <CardTitle className="font-heading text-base">Solicitudes Recientes</CardTitle>
              </div>
              <Link to="/conductor/requests" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {recentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay solicitudes aún.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentRequests.map((req: any) => (
                    <div
                      key={req.id}
                      onClick={() => navigate("/conductor/requests", { state: { openRequestId: req.id } })}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{resolveRequestTypeName(req)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(req.created_at).toLocaleDateString("es-CL")}</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Registro de Vacaciones (reemplaza Últimos Mensajes) */}
        <div className="space-y-6">
          <ConductorVacationsCard />
        </div>
      </div>
    </div>
  );
}
