import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { Plate } from "@/components/ui/plate";
import { Truck, Calendar, Palette } from "lucide-react";
import VehicleInspectionView from "@/features/vehicles/components/VehicleInspectionView";

export default function ConductorVehicles() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("vehicle_assignments")
      .select("*, vehicles(*)")
      .eq("profile_id", profile.id)
      .then(({ data }) => {
        const list = data || [];
        setVehicles(list);
        if (list.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(list[0].vehicles?.id || null);
        }
      });
  }, [profile, selectedVehicleId]);

  const activeVehicle = vehicles.find((va) => va.vehicles?.id === selectedVehicleId)?.vehicles || vehicles[0]?.vehicles;

  return (
    <div className="space-y-6">
      <PageHeader title="Mis Vehículos" description="Vehículos asignados a tu perfil e inspección de estado" />

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="empty-state py-12 text-center text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 text-muted-foreground/60" />
            <p className="font-medium">No tienes vehículos asignados aún.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Tarjetas de vehículos asignados */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Vehículo Asignado
            </h3>
            {vehicles.map((va: any) => {
              const v = va.vehicles;
              if (!v) return null;
              const isSelected = activeVehicle?.id === v.id;
              return (
                <Card
                  key={va.id}
                  onClick={() => setSelectedVehicleId(v.id)}
                  className={`cursor-pointer transition-all overflow-hidden ${
                    isSelected
                      ? "ring-2 ring-primary shadow-md border-primary/40"
                      : "hover:border-primary/50 opacity-90 hover:opacity-100"
                  }`}
                >
                  {/* Header con patente destacada */}
                  <div className="bg-primary/5 border-b px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <Plate licensePlate={v.license_plate} className="text-sm" />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {v.status === "active" ? "Activo" : v.status}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Seleccionado
                      </span>
                    )}
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
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {v.year || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Color</p>
                        <p className="font-medium flex items-center gap-1">
                          <Palette className="h-3 w-3" />
                          {v.color || "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Columna Derecha: Inspección y diagrama del vehículo (Cuadro Rojo de la Imagen 1) */}
          <div className="lg:col-span-8 xl:col-span-8">
            {activeVehicle ? (
              <VehicleInspectionView
                vehicleId={activeVehicle.id}
                licensePlate={activeVehicle.license_plate}
                make={activeVehicle.make}
                model={activeVehicle.model}
                year={activeVehicle.year}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Selecciona un vehículo para inspeccionar sus detalles.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
