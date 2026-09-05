import { useState, useEffect, useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { format, differenceInCalendarDays, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Palmtree,
  CalendarRange,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar as CalendarIcon,
  XCircle,
  Truck,
  History,
  ArrowRight,
} from "lucide-react";
import {
  fetchConductorVacations,
  registerConductorVacation,
  cancelConductorVacation,
  type ConductorVacation,
} from "../services/vacationsService";

interface ConductorVacationsCardProps {
  className?: string;
}

export default function ConductorVacationsCard({ className = "" }: ConductorVacationsCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [vacations, setVacations] = useState<ConductorVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignedVehicle, setAssignedVehicle] = useState<{ id: string; license_plate: string } | null>(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState<"solicitar" | "historial">("solicitar");

  // Date range picker state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cancel dialog state
  const [vacationToCancel, setVacationToCancel] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const loadData = async () => {
    if (!profile) return;
    try {
      // 1. Obtener vehículo asignado
      const { data: vData } = await supabase
        .from("vehicle_assignments")
        .select("vehicle_id, vehicles(id, license_plate)")
        .eq("profile_id", profile.id)
        .limit(1)
        .maybeSingle();

      if (vData?.vehicles) {
        setAssignedVehicle(vData.vehicles as unknown as { id: string; license_plate: string });
      }

      // 2. Obtener vacaciones
      const vacs = await fetchConductorVacations(profile.id);
      setVacations(vacs);
    } catch (error) {
      console.warn("Error cargando vacaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  // Vacaciones activas o programadas vigentes
  const activeVacation = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return vacations.find(
      (v) => (v.status === "programada" || v.status === "en_curso") && v.end_date >= today,
    );
  }, [vacations]);

  // Cálculo de días seleccionados
  const daysCount = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  }, [dateRange]);

  // Total de días tomados o solicitados
  const totalDaysRegistered = useMemo(() => {
    return vacations
      .filter((v) => v.status !== "cancelada")
      .reduce((acc, curr) => acc + (curr.days_count || 0), 0);
  }, [vacations]);

  const handleConfirmVacations = async () => {
    if (!profile || !dateRange?.from || !dateRange?.to) return;

    setSubmitting(true);
    try {
      const startDate = format(dateRange.from, "yyyy-MM-dd");
      const endDate = format(dateRange.to, "yyyy-MM-dd");

      await registerConductorVacation({
        profileId: profile.id,
        vehicleId: assignedVehicle?.id || null,
        startDate,
        endDate,
        daysCount,
      });

      setDateRange(undefined);
      setConfirmOpen(false);
      await loadData();
      setActiveTab("historial");

      toast({
        title: "Vacaciones registradas con éxito",
        description: `Postergación de pago activada del ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")}. Recargo del 10% al retorno.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron registrar las vacaciones",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancelVacation = async () => {
    if (!vacationToCancel) return;
    setCanceling(true);
    try {
      await cancelConductorVacation(vacationToCancel);
      setVacationToCancel(null);
      await loadData();
      toast({
        title: "Vacaciones canceladas",
        description: "Se anuló el período y la postergación de pago asociada.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cancelar la vacación",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const formatSafeDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr + (dateStr.length <= 10 ? "T12:00:00" : ""));
      return format(d, "dd 'de' MMM, yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatSafeDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return format(d, "dd/MM/yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: ConductorVacation["status"]) => {
    switch (status) {
      case "en_curso":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px] shadow-sm">
            <Clock className="h-3 w-3" /> En curso
          </Badge>
        );
      case "programada":
        return (
          <Badge
            variant="outline"
            className="border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10 gap-1 text-[11px]"
          >
            <CalendarRange className="h-3 w-3" /> Programada
          </Badge>
        );
      case "finalizada":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> Finalizada
          </Badge>
        );
      case "cancelada":
        return (
          <Badge variant="destructive" className="gap-1 text-[11px] opacity-90">
            <XCircle className="h-3 w-3" /> Cancelada
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className={`border shadow-sm overflow-hidden ${className}`}>
      <CardHeader className="bg-muted/30 border-b pb-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Palmtree className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-heading flex items-center gap-2 flex-wrap">
                Registro de Vacaciones
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                  Recargo 10% al retorno
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Activa la postergación del pago de arriendo y revisa tu historial
              </CardDescription>
            </div>
          </div>

          {assignedVehicle && (
            <Badge variant="secondary" className="gap-1 font-mono text-[11px] self-start sm:self-auto">
              <Truck className="h-3 w-3" /> Patente: {assignedVehicle.license_plate}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* PESTAÑAS: SOLICITUD vs HISTORIAL */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "solicitar" | "historial")} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 mb-4">
            <TabsList className="h-8">
              <TabsTrigger value="solicitar" className="text-xs gap-1.5 px-3">
                <CalendarRange className="h-3.5 w-3.5" />
                Registrar Vacaciones
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs gap-1.5 px-3">
                <History className="h-3.5 w-3.5" />
                Historial de Vacaciones
                {vacations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] h-4 font-mono">
                    {vacations.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {activeVacation ? (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {activeVacation.status === "en_curso" ? "Vacaciones en curso" : "Vacaciones programadas"}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground font-mono">
                {vacations.length === 0 ? "Sin vacaciones registradas" : `${vacations.length} registro(s)`}
              </span>
            )}
          </div>

          {/* ===================== TAB 1: REGISTRAR VACACIONES ===================== */}
          <TabsContent value="solicitar" className="mt-0 space-y-4">
            {/* Si ya hay vacaciones vigentes o programadas, mostrar aviso destacado */}
            {activeVacation && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm">
                        {activeVacation.status === "en_curso"
                          ? "¡Estás en período de vacaciones!"
                          : "Tienes Vacaciones Programadas"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Período: {formatSafeDate(activeVacation.start_date)} al {formatSafeDate(activeVacation.end_date)} ({activeVacation.days_count} días)
                      </p>
                    </div>
                  </div>
                  {renderStatusBadge(activeVacation.status)}
                </div>

                {/* Aviso informativo de la postergación y recargo */}
                <div className="rounded-lg bg-background/80 border p-3 text-xs space-y-1 text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Condición de Postergación Activa:
                  </p>
                  <p>
                    Durante este período, el pago de arriendo de tu vehículo asignado se encuentra{" "}
                    <span className="font-medium text-foreground">postergado</span>.
                  </p>
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    Al regresar de tus vacaciones, se reactivará el cobro con el recargo del 10% acordado.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0 h-auto text-primary gap-1"
                    onClick={() => setActiveTab("historial")}
                  >
                    <History className="h-3.5 w-3.5" /> Ver en historial completo
                  </Button>

                  {activeVacation.status === "programada" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive gap-1.5 h-8"
                      onClick={() => setVacationToCancel(activeVacation.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancelar Vacaciones Programadas
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Formulario con Calendario para seleccionar salida y regreso */}
            <div className="space-y-4">
              {activeVacation && (
                <div className="flex items-center gap-2 pt-1">
                  <Separator className="flex-1" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Programar Nuevo Período
                  </span>
                  <Separator className="flex-1" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Calendario react-day-picker modo range */}
                <div className="md:col-span-6 flex flex-col items-center justify-center p-1 rounded-xl border bg-muted/10">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={{ before: startOfToday() }}
                    locale={es}
                    className="rounded-md"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 mb-2 font-mono text-center">
                    💡 Haz clic en la fecha de salida y luego en la fecha de regreso
                  </p>
                </div>

                {/* Resumen de selección y confirmación */}
                <div className="md:col-span-6 space-y-3.5">
                  <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Resumen de Fechas
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border bg-background p-2.5">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          🛫 Fecha de Salida
                        </p>
                        <p className="font-bold text-sm mt-0.5">
                          {dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : "—"}
                        </p>
                      </div>

                      <div className="rounded-lg border bg-background p-2.5">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          🛬 Fecha de Regreso
                        </p>
                        <p className="font-bold text-sm mt-0.5">
                          {dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : "—"}
                        </p>
                      </div>
                    </div>

                    {daysCount > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1 px-1">
                        <span className="text-muted-foreground">Duración total:</span>
                        <span className="font-bold font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {daysCount} día{daysCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Cuadro de advertencia obligatorio del recargo */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Condiciones de la Postergación
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      Al registrar tus vacaciones, se activará la{" "}
                      <strong>postergación del pago de arriendo</strong> del vehículo asignado.
                    </p>
                    <p className="leading-relaxed text-[11px] font-semibold text-amber-800 dark:text-amber-100">
                      ⚠️ Al regresar de vacaciones, el pago de arriendo se reanudará con un recargo del 10%.
                    </p>
                  </div>

                  {/* Botón de Confirmación */}
                  <Button
                    className="w-full text-xs h-10 gap-1.5 shadow-sm font-semibold"
                    disabled={!dateRange?.from || !dateRange?.to || daysCount < 1 || submitting}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <CalendarRange className="h-4 w-4" />
                    Confirmar Vacaciones y Postergación (Recargo 10%)
                  </Button>
                </div>
              </div>

              {/* Acceso directo al historial si existen registros */}
              {vacations.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <span>
                    Tienes <strong>{vacations.length}</strong> registro(s) en tu historial de vacaciones.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1 text-primary hover:text-primary"
                    onClick={() => setActiveTab("historial")}
                  >
                    Ver historial completo <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===================== TAB 2: HISTORIAL DE VACACIONES ===================== */}
          <TabsContent value="historial" className="mt-0 space-y-4">
            {/* Tarjetas de métricas rápidas */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border bg-card p-3 shadow-sm">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Palmtree className="h-3.5 w-3.5 text-primary" /> Solicitudes
                </p>
                <p className="text-lg font-bold mt-1 font-mono">{vacations.length}</p>
              </div>

              <div className="rounded-xl border bg-card p-3 shadow-sm">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" /> Días Postergados
                </p>
                <p className="text-lg font-bold mt-1 font-mono">
                  {totalDaysRegistered} día{totalDaysRegistered !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 shadow-sm">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Recargo Acordado
                </p>
                <p className="text-lg font-bold mt-1 text-amber-600 dark:text-amber-400 font-mono">10%</p>
              </div>
            </div>

            {/* Listado de registros */}
            {vacations.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center space-y-3 bg-muted/10">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Sin registros de vacaciones</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Aún no tienes vacaciones registradas. Puedes solicitar tus vacaciones con postergación de arriendo desde la pestaña de registro.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5 mt-2"
                  onClick={() => setActiveTab("solicitar")}
                >
                  <CalendarRange className="h-3.5 w-3.5" /> Solicitar Vacaciones Ahora
                </Button>
              </div>
            ) : (
              <div className="max-h-[440px] overflow-y-auto pr-1 space-y-3">
                {vacations.map((vac) => {
                  const startDateStr = formatSafeDate(vac.start_date);
                  const endDateStr = formatSafeDate(vac.end_date);
                  const createdStr = vac.created_at ? formatSafeDateTime(vac.created_at) : null;

                  return (
                    <div
                      key={vac.id}
                      className={`rounded-xl border p-3.5 shadow-sm transition-all space-y-2.5 ${
                        vac.status === "en_curso"
                          ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                          : vac.status === "programada"
                          ? "border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/10"
                          : vac.status === "cancelada"
                          ? "border-muted bg-muted/10 opacity-75"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{startDateStr}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{endDateStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Badge de Estado y Días */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          <Badge variant="outline" className="font-mono text-[11px] font-semibold">
                            {vac.days_count} día{vac.days_count > 1 ? "s" : ""}
                          </Badge>
                          {renderStatusBadge(vac.status)}
                        </div>
                      </div>

                      {/* Condiciones del arriendo e información del vehículo */}
                      <div className="rounded-lg bg-background/80 border p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="flex items-center gap-1 text-muted-foreground text-[11px]">
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="font-medium text-foreground">Condición de pago:</span>{" "}
                            {vac.status === "cancelada"
                              ? "Solicitud cancelada (cobro regular)"
                              : "Arriendo postergado durante el período"}
                          </p>
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Recargo acordado al retorno: {vac.surcharge_percentage || 10}%
                          </p>
                        </div>

                        {(vac.vehicles?.license_plate || assignedVehicle?.license_plate) && (
                          <Badge variant="secondary" className="gap-1 font-mono text-[10px] self-start sm:self-auto">
                            <Truck className="h-2.5 w-2.5" />
                            {vac.vehicles?.license_plate || assignedVehicle?.license_plate}
                          </Badge>
                        )}
                      </div>

                      {/* Pie con fecha de solicitud y posible acción de cancelar */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground flex-wrap gap-2">
                        <span>
                          {createdStr ? `Registrado: ${createdStr}` : `Registro ID: ${vac.id.slice(0, 8)}`}
                        </span>

                        {vac.status === "programada" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                            onClick={() => setVacationToCancel(vac.id)}
                          >
                            <XCircle className="h-3 w-3" /> Cancelar Vacaciones
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* MODAL DE CONFIRMACIÓN EXPLÍCITA DE VACACIONES */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-heading text-base">
              <Palmtree className="h-5 w-5 text-primary" />
              ¿Confirmar registro de vacaciones?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-xs text-muted-foreground pt-2">
              <p>
                Estás solicitando vacaciones desde el{" "}
                <strong className="text-foreground">
                  {dateRange?.from ? format(dateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: es }) : ""}
                </strong>{" "}
                hasta el{" "}
                <strong className="text-foreground">
                  {dateRange?.to ? format(dateRange.to, "dd 'de' MMMM 'de' yyyy", { locale: es }) : ""}
                </strong>{" "}
                ({daysCount} días).
              </p>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
                <p className="font-semibold text-[11px] text-amber-800 dark:text-amber-100">
                  ⚠️ Importante:
                </p>
                <p className="text-[11px] mt-1">
                  Se activará la <strong>postergación del pago de arriendo</strong> de tu vehículo durante todo el
                  período de vacaciones. Al regresar, el pago se reanudará con un <strong>recargo del 10%</strong>.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs font-semibold"
              onClick={handleConfirmVacations}
              disabled={submitting}
            >
              {submitting ? "Registrando..." : "Sí, confirmar vacaciones y postergación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DE CONFIRMACIÓN PARA CANCELAR VACACIONES */}
      <AlertDialog open={!!vacationToCancel} onOpenChange={(open) => !open && setVacationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-heading text-base text-destructive">
              <XCircle className="h-5 w-5" />
              ¿Cancelar este período de vacaciones?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
              Esta acción anulará el período de vacaciones programado y desactivará la postergación del arriendo asociada. El cobro del arriendo continuará de forma habitual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" disabled={canceling}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              className="text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancelVacation}
              disabled={canceling}
            >
              {canceling ? "Cancelando..." : "Sí, cancelar vacaciones"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
