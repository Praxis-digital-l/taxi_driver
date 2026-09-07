import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plate } from "@/components/ui/plate";
import { Gauge, Route, CalendarRange, User } from "lucide-react";
import type { AdminSearchMileage, AdminSearchVehicle } from "@/features/admin/services/adminSearchService";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface MileageMonthReportCardProps {
  vehicle: AdminSearchVehicle;
  records: AdminSearchMileage[];
  year: number;
  month: number;
  monthLabel: string;
}

/**
 * Informe mensual de kilometraje en formato calendario.
 * Se captura con html2canvas al descargar como imagen (mismo enfoque que la nómina).
 */
export default function MileageMonthReportCard({
  vehicle,
  records,
  year,
  month,
  monthLabel,
}: MileageMonthReportCardProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekdayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const recordsByDay = new Map<number, AdminSearchMileage[]>();
  for (const record of records) {
    const day = new Date(record.recorded_date).getDate();
    const recordsForDay = recordsByDay.get(day) ?? [];
    recordsForDay.push(record);
    recordsByDay.set(day, recordsForDay);
  }

  const cells: (number | null)[] = [];
  for (let index = 0; index < firstWeekdayOffset; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const first = records[0];
  const last = records[records.length - 1];
  const kmsRecorridos = first && last && last.kilometers > first.kilometers
    ? last.kilometers - first.kilometers
    : 0;

  const distinctConductors = [...new Set(
    records
      .map((record) => record.profiles?.full_name?.trim())
      .filter((name): name is string => Boolean(name)),
  )];

  return (
    <Card className="border-primary/20 bg-white text-foreground">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base">Informe de Kilometraje</CardTitle>
            <Plate licensePlate={vehicle.license_plate} />
            <p className="text-xs text-muted-foreground">
              {vehicle.make ?? "Sin marca"} {vehicle.model ?? ""} {vehicle.year ? `• ${vehicle.year}` : ""}
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
            <p className="font-medium text-foreground">Transportes El Montañez</p>
            <p className="capitalize">{monthLabel}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />Registros
            </p>
            <p className="font-heading font-bold text-lg">{records.length}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Route className="h-3.5 w-3.5" />Km recorridos
            </p>
            <p className="font-heading font-bold text-lg">
              {kmsRecorridos > 0 ? `${kmsRecorridos.toLocaleString("es-CL")} km` : "—"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-primary/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <User className="h-3.5 w-3.5" />Conductores
          </p>
          {distinctConductors.length > 0 ? (
            <p className="text-sm font-medium mt-0.5">
              {distinctConductors.map((name, index) => (
                <span key={name}>
                  {index > 0 && <span className="text-muted-foreground"> | </span>}
                  {name}
                </span>
              ))}
              {distinctConductors.length > 1 && (
                <span className="ml-2 text-xs text-muted-foreground">(nombre cambia según quién condujo)</span>
              )}
            </p>
          ) : (
            <p className="text-sm mt-0.5 text-muted-foreground">Sin conductor registrado</p>
          )}
        </div>

        <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted/40 overflow-hidden">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="bg-muted/30 px-1.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {weekday}
            </div>
          ))}
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-[96px] bg-white" />;
            }

            const dayRecords = recordsByDay.get(day) ?? [];

            return (
              <div key={day} className="min-h-[96px] bg-white p-1.5 flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">{day}</span>
                {dayRecords.map((record) => (
                  <div key={record.id} className="rounded-md border border-primary/15 bg-primary/5 px-1.5 py-1">
                    <p className="text-xs font-heading font-bold leading-tight">
                      {record.kilometers.toLocaleString("es-CL")} km
                    </p>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      {record.profiles?.full_name ?? "Sin conductor"}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground border-t pt-2">
          <Gauge className="h-3 w-3" />
          Último registro del mes: {last && new Date(last.recorded_date).toLocaleDateString("es-CL")} con{" "}
          {last?.kilometers.toLocaleString("es-CL")} km
        </p>
      </CardContent>
    </Card>
  );
}