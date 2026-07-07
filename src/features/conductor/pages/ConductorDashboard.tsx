import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { Truck, FileText, ClipboardList, AlertTriangle, Gauge, MessageSquare, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function ConductorDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    vehicles: 0, documents: 0, pendingRequests: 0,
    totalRequests: 0, pendingMessages: 0, lastMileage: 0,
    expiringDocs: 0,
  });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      const [vRes, dRes, rRes, mRes, msgRes, expRes, msgListRes] = await Promise.all([
        supabase.from("vehicle_assignments").select("id", { count: "exact" }).eq("profile_id", profile.id),
        supabase.from("documents").select("id", { count: "exact" }).eq("profile_id", profile.id),
        supabase.from("requests").select("*, request_types(name)").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("mileage_records").select("kilometers").eq("profile_id", profile.id).order("recorded_date", { ascending: false }).limit(1),
        supabase.from("messages").select("id", { count: "exact" }).eq("receiver_id", profile.id).eq("status", "pendiente"),
        supabase.from("documents").select("id", { count: "exact" }).eq("profile_id", profile.id).lte("expiration_date", thirtyDays).gte("expiration_date", now.toISOString().slice(0, 10)),
        supabase.from("messages").select("*, sender:profiles!messages_sender_id_fkey(full_name)").eq("receiver_id", profile.id).order("created_at", { ascending: false }).limit(3),
      ]);

      const pendingReqs = (rRes.data || []).filter((r: any) => r.status === "pendiente" || r.status === "en_proceso");
      setRecentRequests(rRes.data || []);
      setRecentMessages(msgListRes.data || []);
      setHasPending(pendingReqs.length > 0 || (msgRes.count || 0) > 0 || (expRes.count || 0) > 0);
      setStats({
        vehicles: vRes.count || 0,
        documents: dRes.count || 0,
        pendingRequests: pendingReqs.length,
        totalRequests: (rRes.data || []).length,
        pendingMessages: msgRes.count || 0,
        lastMileage: mRes.data?.[0]?.kilometers || 0,
        expiringDocs: expRes.count || 0,
      });
    };
    load();
  }, [profile]);

  return (
    <div className="space-y-6">
      {/* Alerta principal de tareas pendientes */}
      {hasPending && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Existen tareas pendientes</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingRequests > 0 && `${stats.pendingRequests} solicitud(es) sin cerrar. `}
              {stats.pendingMessages > 0 && `${stats.pendingMessages} mensaje(s) pendiente(s). `}
              {stats.expiringDocs > 0 && `${stats.expiringDocs} documento(s) por vencer en 30 días.`}
            </p>
          </div>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Truck, label: "Vehículos Asignados", value: stats.vehicles, to: "/conductor/vehicles", color: "bg-primary/10 text-primary" },
          { icon: FileText, label: "Documentos", value: stats.documents, to: "/conductor/documents", color: "bg-accent/10 text-accent" },
          { icon: ClipboardList, label: "Solicitudes Pendientes", value: stats.pendingRequests, to: "/conductor/requests", color: "bg-warning/10 text-warning" },
          { icon: Gauge, label: "Último Kilometraje", value: stats.lastMileage > 0 ? `${stats.lastMileage.toLocaleString("es-CL")} km` : "—", to: "/conductor/mileage", color: "bg-info/10 text-info" },
        ].map(({ icon: Icon, label, value, to, color }) => (
          <Link key={label} to={to}>
            <Card className="stat-card group cursor-pointer hover:border-primary/30">
              <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{label}</p>
                  <p className="text-xl font-bold font-heading">{value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Solicitudes recientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-base">Solicitudes Recientes</CardTitle>
            <Link to="/conductor/requests" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay solicitudes aún.</p>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{req.request_types?.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString("es-CL")}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos mensajes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-base">Últimos Mensajes</CardTitle>
            <Link to="/conductor/messages" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay mensajes.</p>
            ) : (
              <div className="space-y-2">
                {recentMessages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">De: {msg.sender?.full_name || "Admin"}</p>
                      <p className="text-sm mt-0.5 line-clamp-2">{msg.content}</p>
                    </div>
                    <StatusBadge status={msg.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
