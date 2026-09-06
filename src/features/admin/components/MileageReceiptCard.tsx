import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plate } from "@/components/ui/plate";
import { Gauge, Calendar, User, FileText } from "lucide-react";
import type { AdminSearchMileage, AdminSearchVehicle } from "@/features/admin/services/adminSearchService";

interface MileageReceiptCardProps {
  vehicle: AdminSearchVehicle;
  record: AdminSearchMileage;
}

function Detalle({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value}</p>
      </div>
    </div>
  );
}

/**
 * Documento visual de un registro de kilometraje.
 * Se captura con html2canvas al descargar, como la liquidación de nómina.
 */
export default function MileageReceiptCard({ vehicle, record }: MileageReceiptCardProps) {
  const fecha = new Date(record.recorded_date).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="border-primary/20 bg-white text-foreground">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base">Registro de Kilometraje</CardTitle>
            <Plate licensePlate={vehicle.license_plate} />
            <p className="text-xs text-muted-foreground">
              {vehicle.make ?? "Sin marca"} {vehicle.model ?? ""} {vehicle.year ? `• ${vehicle.year}` : ""}
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
            <p className="font-medium text-foreground">Transportes El Montañez</p>
            <p>{fecha}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <Detalle
          icon={Gauge}
          label="Kilómetros"
          value={<span className="font-heading font-bold text-lg">{record.kilometers.toLocaleString("es-CL")} km</span>}
        />
        <Separator />
        <Detalle icon={Calendar} label="Fecha" value={fecha} />
        <Separator />
        <Detalle icon={User} label="Conductor" value={record.profiles?.full_name ?? "Sin conductor"} />
        <Separator />
        <Detalle
          icon={FileText}
          label="Notas"
          value={<span className="whitespace-pre-wrap">{record.notes ?? "—"}</span>}
        />
      </CardContent>
    </Card>
  );
}