import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import VehicleSchematic from "./VehicleSchematic";
import {
  VEHICLE_PARTS,
  ISSUE_TYPE_LABELS,
  type PartCondition,
  type IssueType,
  type VehicleObservation,
} from "../types/vehicleInspection";
import {
  fetchVehicleObservations,
  createVehicleObservation,
  updateObservationStatus,
  deleteVehicleObservation,
  calculateVehicleHealth,
} from "../services/vehicleInspectionService";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Wrench,
  History,
  Car,
  ShieldCheck,
  User,
  Trash2,
} from "lucide-react";

interface VehicleInspectionViewProps {
  vehicleId: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number | null;
  className?: string;
}

export default function VehicleInspectionView({
  vehicleId,
  licensePlate,
  make,
  model,
  year,
  className = "",
}: VehicleInspectionViewProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [observations, setObservations] = useState<VehicleObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>("hood");
  const [activeTab, setActiveTab] = useState<string>("mechanics");

  // Dialog state
  const [openNewObs, setOpenNewObs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formPartKey, setFormPartKey] = useState<string>("hood");
  const [formCondition, setFormCondition] = useState<PartCondition>("warning");
  const [formIssueType, setFormIssueType] = useState<IssueType>("rayon");
  const [formDescription, setFormDescription] = useState("");

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const loadObservations = async () => {
    try {
      setLoading(true);
      const data = await fetchVehicleObservations(vehicleId);
      setObservations(data);
    } catch (error) {
      console.error("Error cargando observaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      loadObservations();
    }
  }, [vehicleId]);

  const health = useMemo(() => calculateVehicleHealth(observations), [observations]);

  const selectedPart = useMemo(() => {
    return VEHICLE_PARTS.find((p) => p.key === selectedPartKey) || VEHICLE_PARTS[0];
  }, [selectedPartKey]);

  const selectedPartObservations = useMemo(() => {
    if (!selectedPartKey) return [];
    return observations.filter((obs) => obs.part_key === selectedPartKey);
  }, [observations, selectedPartKey]);

  const partsByCategory = useMemo(() => {
    const grouped: Record<string, typeof VEHICLE_PARTS> = {};
    for (const part of VEHICLE_PARTS) {
      if (!grouped[part.category]) {
        grouped[part.category] = [];
      }
      grouped[part.category].push(part);
    }
    return grouped;
  }, []);

  const handleSelectPart = (partKey: string) => {
    setSelectedPartKey(partKey);
  };

  const handleOpenNewObsWithPart = (partKey?: string) => {
    const targetKey = partKey || selectedPartKey || "hood";
    setFormPartKey(targetKey);
    setFormCondition("warning");
    setFormIssueType("rayon");
    setFormDescription("");
    setOpenNewObs(true);
  };

  const handleSubmitObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast({ title: "Error", description: "Debes haber iniciado sesión.", variant: "destructive" });
      return;
    }
    if (!formDescription.trim()) {
      toast({ title: "Atención", description: "Ingresa la descripción del detalle.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const partDef = VEHICLE_PARTS.find((p) => p.key === formPartKey);
      const partName = partDef ? partDef.name : formPartKey;

      const created = await createVehicleObservation({
        vehicleId,
        profileId: profile.id,
        partKey: formPartKey,
        partName,
        condition: formCondition,
        issueType: formIssueType,
        description: formDescription.trim(),
      });

      // Reload to ensure we have author relation from DB
      await loadObservations();
      setSelectedPartKey(formPartKey);
      setOpenNewObs(false);
      setFormDescription("");

      toast({
        title: "Observación guardada",
        description: `Se registró el detalle en ${partName} en la base de datos.`,
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "No se pudo guardar la observación",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (obs: VehicleObservation) => {
    const newStatus = obs.status === "reparado" ? "pendiente" : "reparado";
    try {
      await updateObservationStatus(obs.id, newStatus);
      await loadObservations();
      toast({
        title: newStatus === "reparado" ? "Detalle resuelto" : "Detalle reactivado",
        description: `Observación actualizada en la base de datos.`,
      });
    } catch (error) {
      toast({
        title: "Error al actualizar",
        description: error instanceof Error ? error.message : "Error al actualizar",
        variant: "destructive",
      });
    }
  };

  const handleDeleteObs = async (obsId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta observación?")) return;
    try {
      await deleteVehicleObservation(obsId);
      await loadObservations();
      toast({ title: "Observación eliminada de la base de datos" });
    } catch (error) {
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "Error al eliminar",
        variant: "destructive",
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-rose-500";
  };

  const getConditionBadge = (condition: PartCondition) => {
    if (condition === "damaged") {
      return (
        <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" /> Dañado
        </Badge>
      );
    }
    if (condition === "warning") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" /> Observación
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" /> Óptimo
      </Badge>
    );
  };

  return (
    <Card className={`border shadow-sm overflow-hidden ${className}`}>
      {/* Header estilo Vehicle Mechanics */}
      <CardHeader className="bg-muted/40 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  Inspección Mecánica y Carrocería
                  <Badge variant="outline" className="font-mono text-xs uppercase font-bold">
                    {licensePlate}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {make} {model} {year ? `(${year})` : ""} · Reporte en tiempo real
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Medidor de Salud General */}
            <div className="text-right border-r pr-3 hidden sm:block">
              <p className="text-[11px] text-muted-foreground font-medium">Condición General</p>
              <p className={`text-xl font-bold font-mono ${getScoreColor(health.overallScore)}`}>
                {health.overallScore}%
              </p>
            </div>

            {/* Botón de nueva observación */}
            <Button
              size="sm"
              className="gap-1.5 shadow-sm text-xs h-9"
              onClick={() => handleOpenNewObsWithPart()}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva Observación
            </Button>
          </div>
        </div>

        {/* Barra de progreso de condición */}
        <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              health.overallScore >= 80 ? "bg-emerald-500" : health.overallScore >= 50 ? "bg-amber-500" : "bg-rose-500"
            }`}
            style={{ width: `${health.overallScore}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Pestañas de modo: Mecánica y Diagrama vs Historial */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-2 border-b pb-2 mb-3">
            <TabsList className="h-8">
              <TabsTrigger value="mechanics" className="text-xs gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Esquema y Piezas
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historial ({observations.length})
              </TabsTrigger>
            </TabsList>

            <span className="text-[11px] text-muted-foreground font-mono">
              {health.activeIssuesCount === 0
                ? "✨ Sin detalles pendientes"
                : `⚠️ ${health.activeIssuesCount} detalle${health.activeIssuesCount > 1 ? "s" : ""} activo${health.activeIssuesCount > 1 ? "s" : ""}`}
            </span>
          </div>

          {/* TAB 1: ESQUEMA DEL VEHÍCULO Y LISTA DE PIEZAS (Style Project Zomboid) */}
          <TabsContent value="mechanics" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Columna Izquierda: Esquema Cenital SVG */}
              <div className="lg:col-span-6 xl:col-span-7">
                <VehicleSchematic
                  partStatusMap={health.partStatusMap}
                  selectedPartKey={selectedPartKey}
                  onSelectPart={handleSelectPart}
                />
              </div>

              {/* Columna Derecha: Inspector de Piezas y Detalle de Selección */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-3">
                {/* Tarjeta de la Pieza Seleccionada */}
                <div className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                        {selectedPart.category}
                      </span>
                      <h4 className="text-sm font-bold font-heading">{selectedPart.name}</h4>
                    </div>
                    {getConditionBadge(health.partStatusMap[selectedPart.key])}
                  </div>

                  {/* Observaciones de la pieza seleccionada */}
                  <div className="mt-3 space-y-2">
                    {selectedPartObservations.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">
                        Esta pieza no presenta detalles ni observaciones registradas.
                      </p>
                    ) : (
                      selectedPartObservations.map((obs) => (
                        <div
                          key={obs.id}
                          className={`text-xs p-2.5 rounded-lg border flex flex-col gap-1 ${
                            obs.status === "reparado"
                              ? "bg-muted/40 border-muted opacity-75"
                              : obs.condition === "damaged"
                              ? "bg-rose-500/5 border-rose-500/20"
                              : "bg-amber-500/5 border-amber-500/20"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              {ISSUE_TYPE_LABELS[obs.issue_type] || obs.issue_type}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 capitalize ${
                                obs.status === "reparado"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {obs.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{obs.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1 border-t border-dashed">
                            <span className="flex items-center gap-1 font-medium">
                              <User className="h-2.5 w-2.5" />
                              {obs.profiles?.full_name || "Usuario"}
                              {obs.profiles?.role && (
                                <span className="uppercase text-[8px] bg-muted px-1 rounded">
                                  {obs.profiles.role}
                                </span>
                              )}
                            </span>
                            <span>{new Date(obs.created_at).toLocaleDateString("es-CL")}</span>
                          </div>
                        </div>
                      ))
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5 mt-2 border-dashed"
                      onClick={() => handleOpenNewObsWithPart(selectedPart.key)}
                    >
                      <Plus className="h-3 w-3" />
                      Reportar Detalle en {selectedPart.name}
                    </Button>
                  </div>
                </div>

                {/* Lista Categorizada de Piezas (Style Mechanics Menu) */}
                <div className="rounded-xl border bg-muted/20 p-2 max-h-[300px] overflow-y-auto space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground px-2">
                    COMPONENTES DEL VEHÍCULO
                  </p>
                  {Object.entries(partsByCategory).map(([category, parts]) => (
                    <div key={category} className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase px-2">
                        {category}
                      </p>
                      <div className="grid grid-cols-1 gap-1">
                        {parts.map((part) => {
                          const condition = health.partStatusMap[part.key] || "good";
                          const isSelected = selectedPartKey === part.key;
                          return (
                            <button
                              key={part.key}
                              type="button"
                              onClick={() => handleSelectPart(part.key)}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                                isSelected
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "hover:bg-muted/60 text-foreground"
                              }`}
                            >
                              <span className="truncate pr-2">{part.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    condition === "damaged"
                                      ? "bg-rose-500 animate-pulse"
                                      : condition === "warning"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: HISTORIAL CRONOLÓGICO COMPLETO */}
          <TabsContent value="history" className="mt-0">
            {observations.length === 0 ? (
              <div className="text-center py-8 border rounded-xl bg-muted/20">
                <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-medium">Vehículo sin observaciones</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tanto el conductor como el administrador pueden registrar detalles aquí.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => handleOpenNewObsWithPart()}
                >
                  <Plus className="h-3.5 w-3.5" /> Registrar primera observación
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {observations.map((obs) => (
                  <div
                    key={obs.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      obs.status === "reparado"
                        ? "bg-muted/20 border-muted opacity-80"
                        : obs.condition === "damaged"
                        ? "bg-rose-500/5 border-rose-500/25"
                        : "bg-amber-500/5 border-amber-500/25"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getConditionBadge(obs.condition)}
                        <span className="font-bold text-sm">{obs.part_name}</span>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({ISSUE_TYPE_LABELS[obs.issue_type] || obs.issue_type})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            obs.status === "reparado"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          }`}
                        >
                          {obs.status === "reparado" ? "Resuelto / Reparado" : "Pendiente"}
                        </Badge>

                        {/* Botón para marcar como resuelto */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleToggleStatus(obs)}
                        >
                          {obs.status === "reparado" ? "Reabrir" : "Marcar Resuelto"}
                        </Button>

                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteObs(obs.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                      {obs.description}
                    </p>

                    <div className="mt-3 pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        <span className="font-medium text-foreground">
                          {obs.profiles?.full_name || "Usuario"}
                        </span>
                        <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0">
                          {obs.profiles?.role || "Usuario"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {new Date(obs.created_at).toLocaleString("es-CL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* DIALOG: REGISTRAR NUEVA OBSERVACIÓN O DETALLE */}
      <Dialog open={openNewObs} onOpenChange={setOpenNewObs}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Registrar Observación en Vehículo ({licensePlate})
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitObservation} className="space-y-3.5 mt-2">
            {/* Selector de pieza */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pieza o Sector Afectado *</Label>
              <Select value={formPartKey} onValueChange={setFormPartKey}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {VEHICLE_PARTS.map((part) => (
                    <SelectItem key={part.key} value={part.key} className="text-xs">
                      {part.category} - {part.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Condición / Gravedad */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Estado / Gravedad *</Label>
                <Select value={formCondition} onValueChange={(val: PartCondition) => setFormCondition(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good" className="text-xs">
                      🟢 Óptimo / Normal
                    </SelectItem>
                    <SelectItem value="warning" className="text-xs">
                      🟡 Observación Leve
                    </SelectItem>
                    <SelectItem value="damaged" className="text-xs">
                      🔴 Dañado / Crítico
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de problema */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Detalle *</Label>
                <Select value={formIssueType} onValueChange={(val: IssueType) => setFormIssueType(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ISSUE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Detalle de la Observación *</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe el estado de la pieza, rayón, falla, o novedad encontrada..."
                rows={3}
                className="text-xs resize-none"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => setOpenNewObs(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="text-xs h-9" disabled={submitting}>
                {submitting ? "Guardando..." : "Registrar Observación"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

