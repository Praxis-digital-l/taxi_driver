import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function ConductorDashboard() {
  const [stats, setStats] = useState({ vehicles: 0, documents: 0, requests: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const userId = (await supabase.auth.getSession()).data.session?.user?.id;
      if (!userId) return;

      const [vehicles, documents, requests] = await Promise.all([
        supabase.from("vehicles").select("id").eq("driver_id", userId),
        supabase.from("documents").select("id").eq("user_id", userId),
        supabase.from("requests").select("id").eq("user_id", userId),
      ]);

      setStats({
        vehicles: vehicles.data?.length || 0,
        documents: documents.data?.length || 0,
        requests: requests.data?.length || 0,
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard del Conductor</h1>
        <p className="text-muted-foreground">Resumen de tu información</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mis Vehículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.vehicles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.documents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.requests}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
