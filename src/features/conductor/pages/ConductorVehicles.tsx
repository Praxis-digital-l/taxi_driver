import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { Truck, Calendar, Palette } from "lucide-react";

export default function ConductorVehicles() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("vehicle_assignments")
      .select("*, vehicles(*)")
      .eq("profile_id", profile.id)
      .then(({ data }) => setVehicles(data || []));
  }, [profile]);

  return (
    <div>
      <PageHeader title="Mis Vehículos" description="Vehículos asignados a tu perfil" />

      {vehicles.length === 0 ? (
        <Card><CardContent className="empty-state"><Truck /><p>No tienes vehículos asignados aún.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((va: any) => {
            const v = va.vehicles;
            return (
              <Card key={va.id} className="stat-card overflow-hidden">
                {/* Header con patente destacada */}
                <div className="bg-primary/5 border-b px-5 py-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-lg tracking-wider">{v.license_plate}</p>
                    <p className="text-xs text-muted-foreground">{v.status === "active" ? "Activo" : v.status}</p>
                  </div>
                </div>
                <CardContent className="p-5 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Marca</p>
                      <p className="font-medium">{v.make}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Modelo</p>
                      <p className="font-medium">{v.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Año</p>
                      <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" />{v.year || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Color</p>
                      <p className="font-medium flex items-center gap-1"><Palette className="h-3 w-3" />{v.color || "—"}</p>
                    </div>
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
