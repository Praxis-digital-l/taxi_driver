import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import RequestTypeIcon from "@/components/RequestTypeIcon";
import PageHeader from "@/components/PageHeader";
import { resolveRequestTypeName } from "@/lib/requestPriority";
import { canRequestType } from "@/lib/requestBenefits";
import {
  isLoanRequestType,
  hasActiveLoanRequest,
  validateLoanRequest,
  calculateLoanBreakdown,
  buildLoanDetails,
} from "@/lib/loanRules";
import { Car, ClipboardList, Pencil, Plus, Trash2, Wallet, XCircle, CheckCircle2, AlertTriangle, Star, Palmtree } from "lucide-react";

const TERMINAL_STATUSES = ["aprobado", "rechazado", "completado"];
const FILTER_STATUSES = ["pendiente", "aprobado", "rechazado"];

function parseResolution(details: string | null) {
  if (!details) return null;
  const match = details.match(/\n\n--- MOTIVO DEL RECHAZO \(([^)]+)\) ---\n([\s\S]*)$/);
  if (!match) return null;
  return { date: match[1], reason: match[2].trim() };
}

function stripResolution(details: string | null) {
  if (!details) return "";
  return details.replace(/\n\n--- MOTIVO DEL RECHAZO .*/s, "");
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("es-CL");
}
function formatDateFull(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleString("es-CL");
}
function formatAmount(value: number | null | undefined) {
  if (value == null) return null;
  return `$${Number(value).toLocaleString("es-CL")}`;
}

function isVacationRequest(req?: { request_types?: { name?: string | null } | null; details?: string | null } | null) {
  if (!req) return false;
  const name = (req.request_types?.name || "").toLowerCase().trim();
  return (
    name === "vacaciones" ||
    req.details?.includes("[VACACIONES") ||
    req.details?.includes("[SOLICITUD DE VACACIONES")
  );
}

export default function ConductorRequests() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [reqTypes, setReqTypes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [newDetails, setNewDetails] = useState("");
  const [newTypeId, setNewTypeId] = useState("");
  const [newVehicleId, setNewVehicleId] = useState("none");

  // Campos específicos de préstamo
  const [loanAmount, setLoanAmount] = useState<string>("100000");
  const [loanCuotas, setLoanCuotas] = useState<number>(1);
  const [isSpecialRequest, setIsSpecialRequest] = useState<boolean>(false);
  const [loanConfirmOpen, setLoanConfirmOpen] = useState<boolean>(false);

  const [detailReq, setDetailReq] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editReq, setEditReq] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editTypeId, setEditTypeId] = useState("");
  const [editVehicleId, setEditVehicleId] = useState("none");
  const [editAmount, setEditAmount] = useState("");
  const [editDetails, setEditDetails] = useState("");

  const [deleteReq, setDeleteReq] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const location = useLocation();

  const load = async () => {
    if (!profile) return;
    const [rRes, tRes, vRes] = await Promise.all([
      supabase.from("requests").select("*, request_types(name), vehicles(license_plate)").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("request_types").select("*").order("name"),
      supabase.from("vehicle_assignments").select("vehicles(id, license_plate)").eq("profile_id", profile.id),
    ]);
    setRequests(rRes.data || []);
    setReqTypes(tRes.data || []);
    setVehicles((vRes.data || []).map((va: any) => va.vehicles));
    return rRes.data || [];
  };

  useEffect(() => { load(); }, [profile]);

  useEffect(() => {
    if (!location.state || !requests.length) return;
    const state = location.state as any;
    if (state.openRequestId) {
      const found = requests.find((r: any) => r.id === state.openRequestId);
      if (found) {
        setDetailReq(found);
        setDetailOpen(true);
      }
      window.history.replaceState({}, "");
    }
  }, [location.state, requests]);

  const openNewRequest = (typeId = "") => {
    setNewTypeId(typeId);
    setNewVehicleId("none");
    setNewDetails("");
    setLoanAmount("100000");
    setLoanCuotas(1);
    setIsSpecialRequest(false);
    setOpen(true);
  };

  const selectedNewType = reqTypes.find((t) => t.id === newTypeId);
  const isLoanSelected = isLoanRequestType(selectedNewType?.name);
  const driverScore = profile?.score ?? 0;
  const isScoreEligible = driverScore >= 8;
  const hasActiveLoan = hasActiveLoanRequest(requests);
  const isEstadoAntiguo = profile?.estado_conductor === "antiguo";

  // Límites estrictos según requerimiento:
  // - Conductor Antiguo: hasta $500.000 estándar; si "Solicitud Especial" está activa, hasta $1.000.000.
  // - Conductor Nuevo: hasta $300.000.
  const maxLoanLimit = isEstadoAntiguo
    ? (isSpecialRequest ? 1000000 : 500000)
    : 300000;

  const handleLoanAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setLoanAmount("");
      return;
    }
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      setLoanAmount("");
      return;
    }
    if (parsed < 0) {
      setLoanAmount("0");
      return;
    }
    // Límite estricto: no permite números infinitos ni mayores al límite aplicable
    if (parsed > maxLoanLimit) {
      setLoanAmount(String(maxLoanLimit));
      return;
    }
    setLoanAmount(String(parsed));
  };

  const handleLoanAmountBlur = () => {
    const parsed = parseInt(loanAmount, 10) || 0;
    if (parsed > 0 && parsed < 100000) {
      setLoanAmount("100000");
    } else if (parsed > maxLoanLimit) {
      setLoanAmount(String(maxLoanLimit));
    }
  };

  const currentLoanBreakdown = calculateLoanBreakdown(
    Math.max(0, parseInt(loanAmount, 10) || 0),
    loanCuotas
  );

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    if (!newTypeId) {
      toast({ title: "Error", description: "Selecciona un tipo de solicitud.", variant: "destructive" });
      return;
    }

    if (isLoanSelected) {
      const parsedAmount = parseInt(loanAmount, 10) || 0;

      if (parsedAmount > maxLoanLimit) {
        toast({
          title: "Monto excede el límite permitido",
          description: `El monto máximo permitido es de ${formatAmount(maxLoanLimit)}.`,
          variant: "destructive",
        });
        setLoanAmount(String(maxLoanLimit));
        return;
      }

      const validation = validateLoanRequest({
        score: driverScore,
        estadoConductor: profile.estado_conductor ?? "antiguo",
        amount: parsedAmount,
        cuotas: loanCuotas,
        hasActiveLoan,
        isSpecialRequested: isSpecialRequest,
      });

      if (!validation.valid) {
        toast({
          title: "Requisitos de préstamo no cumplidos",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      // Requisito: Mensaje resaltado de recargo del 20% con opción para continuar o no
      setLoanConfirmOpen(true);
      return;
    }

    // Flujo normal para solicitudes que no son préstamo
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const amount = parseFloat(form.get("amount") as string);

    const { error } = await supabase.from("requests").insert({
      profile_id: profile.id,
      request_type_id: newTypeId,
      vehicle_id: newVehicleId === "none" ? null : newVehicleId,
      details: newDetails.trim(),
      amount: isNaN(amount) ? null : amount,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitud creada exitosamente" });
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const executeLoanSubmit = async () => {
    if (!profile) return;
    setLoading(true);
    setLoanConfirmOpen(false);

    const parsedAmount = parseInt(loanAmount, 10) || 0;
    const breakdown = calculateLoanBreakdown(parsedAmount, loanCuotas);
    const formattedDetails = buildLoanDetails({
      breakdown,
      motivo: newDetails.trim(),
      isSpecial: isSpecialRequest && isEstadoAntiguo,
      estadoConductor: profile.estado_conductor ?? "antiguo",
    });

    const { error } = await supabase.from("requests").insert({
      profile_id: profile.id,
      request_type_id: newTypeId,
      vehicle_id: newVehicleId === "none" ? null : newVehicleId,
      amount: breakdown.montoSolicitado,
      cuotas: breakdown.cuotas,
      recargo_porcentaje: 20,
      total_con_recargo: breakdown.totalConRecargo,
      es_solicitud_especial: isSpecialRequest && isEstadoAntiguo,
      details: formattedDetails,
    });

    if (error) {
      toast({ title: "Error al solicitar préstamo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Préstamo solicitado con éxito" });
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const openEdit = (req: { id: string; request_type_id: string; vehicle_id: string | null; amount: number | null; details: string | null }) => {
    setEditReq(req);
    setEditTypeId(req.request_type_id ?? "");
    setEditVehicleId(req.vehicle_id ?? "none");
    setEditAmount(req.amount != null ? String(req.amount) : "");
    setEditDetails(stripResolution(req.details));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editReq) return;
    if (!editTypeId) {
      toast({ title: "Error", description: "Selecciona un tipo de solicitud.", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    const amount = parseFloat(editAmount);
    try {
      const { data, error } = await supabase
        .from("requests")
        .update({
          request_type_id: editTypeId,
          vehicle_id: editVehicleId === "none" ? null : editVehicleId,
          amount: isNaN(amount) ? null : amount,
          details: editDetails.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", editReq.id)
        .select();

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("No se pudo guardar la solicitud. Verifica que exista o que tengas permisos para editarla.");
      }

      toast({ title: "Solicitud actualizada exitosamente" });
      setEditOpen(false);
      setEditReq(null);
      load();
    } catch (err) {
      toast({
        title: "Error al actualizar",
        description: err instanceof Error ? err.message : "Ocurrió un error",
        variant: "destructive",
      });
    }
    setEditLoading(false);
  };

  const requestDelete = (req: { id: string; details?: string | null; request_types?: { name: string | null } | null }) => {
    setDeleteReq(req);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteReq) return;
    setDeleteLoading(true);
    try {
      // Si la solicitud eliminada es de Vacaciones, sincronizar cancelación en conductor_vacations
      if (isVacationRequest(deleteReq)) {
        const matchDates = deleteReq.details?.match(/Salida:\s*(\d{4}-\d{2}-\d{2})\s*·\s*Retorno:\s*(\d{4}-\d{2}-\d{2})/);
        let q = supabase
          .from("conductor_vacations")
          .update({ status: "cancelada", updated_at: new Date().toISOString() })
          .eq("profile_id", profile?.id);
        if (matchDates) {
          q = q.eq("start_date", matchDates[1]).eq("end_date", matchDates[2]);
        }
        await q;
      }

      const { data, error } = await supabase.from("requests").delete().eq("id", deleteReq.id).select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("No se pudo eliminar la solicitud. Verifica que exista o que tengas permisos.");
      }
      toast({ title: "Solicitud eliminada exitosamente" });
      setDeleteOpen(false);
      if (detailReq?.id === deleteReq.id) setDetailOpen(false);
      setDeleteReq(null);
      load();
    } catch (err) {
      toast({
        title: "Error al eliminar",
        description: err instanceof Error ? err.message : "Ocurrió un error",
        variant: "destructive",
      });
    }
    setDeleteLoading(false);
  };

  const filtered = filterStatus === "all" ? requests : requests.filter((r: any) => r.status === filterStatus);

  // Verificación estricta de estrellas necesarias:
  const isScoreEligibleForType = (type: { min_score?: number | null; name?: string }) => {
    const score = profile?.score ?? 0;
    if (isLoanRequestType(type.name)) {
      return score >= 8;
    }
    return canRequestType(score, type);
  };

  // REGLA SOLICITADA POR EL USUARIO:
  // "A los que no puedan acceder a las solicitudes ya que no tienen las estrellas necesarias,
  // simplemente no les tiene que aparecer como opción."
  // Además, "Vacaciones" se solicita de forma dedicada desde el panel de Vacaciones en el Dashboard.
  const availableReqTypes = reqTypes.filter((t) => {
    if (t.name?.toLowerCase().trim() === "vacaciones") return false;
    return isScoreEligibleForType(t);
  });

  const availableEditTypes = reqTypes.filter((t) => {
    if (t.name?.toLowerCase().trim() === "vacaciones") return false;
    if (t.id === editReq?.request_type_id) return true;
    return isScoreEligibleForType(t);
  });

  return (
    <div>
      <PageHeader title="Mis Solicitudes" description={`${requests.length} solicitud(es) en total`}>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {FILTER_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => openNewRequest()}><Plus className="mr-1.5 h-4 w-4" />Nueva Solicitud</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Crear Solicitud</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de solicitud *</Label>
                <Select value={newTypeId} onValueChange={setNewTypeId} required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {availableReqTypes.map((t) => {
                      const isLoan = isLoanRequestType(t.name);
                      const isLockedLoan = isLoan && hasActiveLoan;
                      return (
                        <SelectItem key={t.id} value={t.id} disabled={isLockedLoan}>
                          {t.name}
                          {isLockedLoan && " (Préstamo en curso activo)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* FLUJO ESPECIAL PARA PRÉSTAMOS */}
              {isLoanSelected ? (
                <div className="space-y-4 pt-1">
                  {!isScoreEligible && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                      <Star className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Requisito de calificación no cumplido</p>
                        <p>Solo pueden solicitar un préstamo conductores con 8 o más estrellas. Tu calificación actual es de {driverScore} ⭐.</p>
                      </div>
                    </div>
                  )}

                  {hasActiveLoan && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Préstamo o cuotas activas</p>
                        <p>No se puede solicitar préstamos si existen cuotas pendientes por pagar o hay un préstamo en curso.</p>
                      </div>
                    </div>
                  )}

                  {isScoreEligible && !hasActiveLoan && (
                    <>
                      {/* Cartel resaltado obligatorio: Recargo del 20% */}
                      <div className="rounded-xl border-2 border-amber-500 bg-amber-500/10 p-4 space-y-2.5 shadow-sm">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm sm:text-base">
                          <AlertTriangle className="h-5 w-5 shrink-0" />
                          <span>El Préstamo tiene un recargo del 20%</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Ten muy en cuenta que todo préstamo solicitado incluye un recargo administrativo obligatorio del 20% sobre el monto original.
                        </p>

                        {parseInt(loanAmount, 10) > 0 && (
                          <div className="rounded-lg bg-card/90 p-3 text-xs border border-amber-500/20 space-y-1.5 mt-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Monto solicitado:</span>
                              <span className="font-semibold">{formatAmount(currentLoanBreakdown.montoSolicitado)}</span>
                            </div>
                            <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                              <span>Recargo del 20%:</span>
                              <span>+{formatAmount(currentLoanBreakdown.recargoMonto)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 font-bold text-foreground">
                              <span>Total a devolver:</span>
                              <span className="text-primary">{formatAmount(currentLoanBreakdown.totalConRecargo)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground border-t pt-1">
                              <span>Plan de pago:</span>
                              <span className="font-medium text-foreground">{currentLoanBreakdown.cuotas} cuota(s) de {formatAmount(currentLoanBreakdown.valorCuota)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rango y Tipo de Conductor */}
                      <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tipo de conductor:</span>
                          <span className="font-semibold capitalize">{profile?.estado_conductor ?? "antiguo"} ({driverScore} ⭐)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Rango permitido:</span>
                          <span className="font-semibold">
                            {isEstadoAntiguo
                              ? (isSpecialRequest ? "$100.000 a $1.000.000 (Especial)" : "$100.000 a $500.000 (Estándar)")
                              : "$100.000 a $300.000"}
                          </span>
                        </div>
                      </div>

                      {/* Checkbox de Solicitud Especial para Conductor Antiguo */}
                      {isEstadoAntiguo && (
                        <div className="flex items-start space-x-2.5 rounded-lg border p-3 bg-card">
                          <Checkbox
                            id="special-request"
                            checked={isSpecialRequest}
                            onCheckedChange={(checked) => {
                              const isChecked = Boolean(checked);
                              setIsSpecialRequest(isChecked);
                              // Si el usuario desmarca la solicitud especial, el tope vuelve a ser 500.000.
                              // Si el monto actual supera 500.000, se reajusta inmediatamente a 500.000.
                              if (!isChecked) {
                                const current = parseInt(loanAmount, 10) || 0;
                                if (current > 500000) {
                                  setLoanAmount("500000");
                                }
                              }
                            }}
                          />
                          <div className="grid gap-1 leading-none">
                            <label
                              htmlFor="special-request"
                              className="text-xs font-semibold leading-none cursor-pointer text-foreground"
                            >
                              ⭐ Crear Solicitud Especial (hasta $1.000.000)
                            </label>
                            <p className="text-[11px] text-muted-foreground">
                              Activa esta casilla únicamente si necesitas un monto superior a $500.000 (hasta $1.000.000).
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Monto del préstamo con límite estricto */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Monto del Préstamo (CLP) *</Label>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Tope máximo: {formatAmount(maxLoanLimit)}
                          </span>
                        </div>
                        <Input
                          name="amount"
                          type="number"
                          step="10000"
                          min="100000"
                          max={maxLoanLimit}
                          value={loanAmount}
                          onChange={handleLoanAmountChange}
                          onBlur={handleLoanAmountBlur}
                          placeholder={`Ej: ${isEstadoAntiguo ? (isSpecialRequest ? "1000000" : "500000") : "300000"}`}
                          required
                        />

                        {/* Botones de selección rápida de monto */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[11px] text-muted-foreground mr-1">Atajos:</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => setLoanAmount("100000")}
                          >
                            $100.000
                          </Button>
                          {maxLoanLimit >= 200000 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setLoanAmount("200000")}
                            >
                              $200.000
                            </Button>
                          )}
                          {maxLoanLimit >= 300000 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setLoanAmount("300000")}
                            >
                              $300.000
                            </Button>
                          )}
                          {isEstadoAntiguo && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setLoanAmount("500000")}
                            >
                              $500.000
                            </Button>
                          )}
                          {isEstadoAntiguo && isSpecialRequest && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px] border-purple-500/50 text-purple-600 dark:text-purple-400 font-semibold"
                              onClick={() => setLoanAmount("1000000")}
                            >
                              ⭐ $1.000.000
                            </Button>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          {isEstadoAntiguo
                            ? (isSpecialRequest
                                ? "Mínimo $100.000 hasta $1.000.000 máximo (Solicitud Especial activa)."
                                : "Mínimo $100.000 hasta $500.000 máximo estándar. Si necesitas hasta $1.000.000 activa la casilla de Solicitud Especial.")
                            : "Mínimo $100.000 hasta $300.000 máximo para conductores nuevos."}
                        </p>
                      </div>

                      {/* Selector de Cuotas (hasta 6) */}
                      <div className="space-y-2">
                        <Label>Número de Cuotas (máx. 6) *</Label>
                        <Select
                          value={String(loanCuotas)}
                          onValueChange={(val) => setLoanCuotas(parseInt(val, 10) || 1)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 cuota</SelectItem>
                            <SelectItem value="2">2 cuotas</SelectItem>
                            <SelectItem value="3">3 cuotas</SelectItem>
                            <SelectItem value="4">4 cuotas</SelectItem>
                            <SelectItem value="5">5 cuotas</SelectItem>
                            <SelectItem value="6">6 cuotas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Motivo */}
                      <div className="space-y-2">
                        <Label>Motivo del Préstamo</Label>
                        <Textarea
                          name="details"
                          placeholder="Indica el motivo o destino de tu préstamo..."
                          maxLength={500}
                          value={newDetails}
                          onChange={(e) => setNewDetails(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground text-right">{newDetails.length}/500</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* FLUJO ESTÁNDAR PARA OTROS TIPOS DE SOLICITUD */
                <>
                  <div className="space-y-2">
                    <Label>Vehículo asociado</Label>
                    <Select value={newVehicleId} onValueChange={setNewVehicleId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin vehículo</SelectItem>
                        {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto estimado (CLP)</Label>
                    <Input name="amount" type="number" step="1" min="0" placeholder="Ej: 150000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Detalles *</Label>
                    <Textarea name="details" required placeholder="Describe tu solicitud ..." maxLength={500} value={newDetails} onChange={(e) => setNewDetails(e.target.value)} />
                    <p className="text-xs text-muted-foreground text-right">{newDetails.length}/500</p>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || (isLoanSelected && (!isScoreEligible || hasActiveLoan))}
              >
                {loading
                  ? "Procesando..."
                  : isLoanSelected
                  ? "Solicitar Préstamo (con 20% de recargo)"
                  : "Enviar Solicitud"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* DIÁLOGO OBLIGATORIO DE CONFIRMACIÓN DE RECARGO DEL 20% */}
      <AlertDialog open={loanConfirmOpen} onOpenChange={setLoanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Confirmación de Préstamo con Recargo del 20%</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left pt-2 text-sm text-foreground">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ El Préstamo tiene un recargo del 20%.
                </p>
                <div className="rounded-lg bg-muted/60 border p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monto solicitado:</span>
                    <span className="font-semibold">{formatAmount(currentLoanBreakdown.montoSolicitado)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                    <span>Recargo obligatorio (20%):</span>
                    <span>+{formatAmount(currentLoanBreakdown.recargoMonto)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold">
                    <span>Total final a devolver:</span>
                    <span className="text-primary">{formatAmount(currentLoanBreakdown.totalConRecargo)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground border-t pt-1">
                    <span>Modalidad de pago:</span>
                    <span className="font-medium">{currentLoanBreakdown.cuotas} cuota(s) de {formatAmount(currentLoanBreakdown.valorCuota)}</span>
                  </div>
                  {isSpecialRequest && (
                    <div className="flex justify-between text-purple-600 dark:text-purple-400 font-semibold pt-1">
                      <span>Categoría:</span>
                      <span>⭐ Solicitud Especial</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  El conductor debe tener total claridad de que este monto incluye el recargo del 20%. ¿Deseas continuar con el envío de la solicitud?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoanConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeLoanSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 font-semibold"
            >
              {loading ? "Enviando..." : "Sí, continuar y solicitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filtered.length === 0 ? (
        <Card><CardContent className="empty-state"><ClipboardList /><p>No hay solicitudes con estos filtros.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((req: any) => {
            const typeName = resolveRequestTypeName(req);
            const canManage = !TERMINAL_STATUSES.includes(req.status);
            const isVacation = isVacationRequest(req);
            return (
              <Card key={req.id} className="stat-card cursor-pointer overflow-hidden transition-colors hover:border-primary/40 hover:bg-muted/40" onClick={() => { setDetailReq(req); setDetailOpen(true); }}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <RequestTypeIcon typeName={typeName} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{typeName}</p>
                        <StatusBadge status={req.status} />
                        <RequestPriorityBadge requestTypeName={typeName} />
                        {req.es_solicitud_especial && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            ⭐ Solicitud Especial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{stripResolution(req.details) || "Sin detalles"}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {req.amount != null && <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" />{formatAmount(req.amount)}</span>}
                        {req.cuotas != null && <span>({req.cuotas} cuotas)</span>}
                        {req.total_con_recargo != null && <span>Total c/recargo: {formatAmount(req.total_con_recargo)}</span>}
                        {req.vehicles?.license_plate && <span className="inline-flex items-center gap-1"><Car className="h-3 w-3" />{req.vehicles.license_plate}</span>}
                        <span>{new Date(req.created_at).toLocaleDateString("es-CL")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <>
                          {!isVacation && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar solicitud" onClick={() => { setDetailOpen(false); openEdit(req); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Eliminar solicitud" onClick={() => { setDetailOpen(false); requestDelete(req); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-3">
            <DialogTitle className="font-heading">Detalle de Solicitud</DialogTitle>
            <div className="flex items-center gap-1">
              {detailReq && !TERMINAL_STATUSES.includes(detailReq.status) && (
                <>
                  {!isVacationRequest(detailReq) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar solicitud" onClick={() => { setDetailOpen(false); openEdit(detailReq); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Eliminar solicitud" onClick={() => { setDetailOpen(false); requestDelete(detailReq); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-3 text-sm min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0"><span className="text-muted-foreground">Conductor:</span><p className="font-medium truncate">{profile?.full_name ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Tipo:</span><p className="font-medium truncate">{resolveRequestTypeName(detailReq)}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">RUT:</span><p className="font-medium truncate">{profile?.rut ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Teléfono:</span><p className="font-medium truncate">{profile?.phone ?? "—"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Patente:</span><p className="font-medium truncate">{detailReq.vehicles?.license_plate ?? "Sin vehículo"}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Monto Solicitado:</span><p className="font-medium truncate">{detailReq.amount ? formatAmount(detailReq.amount) : "—"}</p></div>
                {detailReq.cuotas != null && (
                  <div className="min-w-0"><span className="text-muted-foreground">Cuotas:</span><p className="font-medium truncate">{detailReq.cuotas} cuota(s){detailReq.total_con_recargo ? ` de ${formatAmount(Math.round(detailReq.total_con_recargo / detailReq.cuotas))}` : ""}</p></div>
                )}
                {detailReq.recargo_porcentaje != null && (
                  <div className="min-w-0"><span className="text-muted-foreground">Recargo:</span><p className="font-medium truncate text-amber-600 dark:text-amber-400">{detailReq.recargo_porcentaje}%</p></div>
                )}
                {detailReq.total_con_recargo != null && (
                  <div className="min-w-0"><span className="text-muted-foreground">Total a Pagar (c/recargo):</span><p className="font-semibold text-primary truncate">{formatAmount(detailReq.total_con_recargo)}</p></div>
                )}
                {detailReq.es_solicitud_especial && (
                  <div className="min-w-0"><span className="text-muted-foreground">Categoría:</span><p className="font-medium text-purple-600 dark:text-purple-400 truncate">⭐ Solicitud Especial (Conductor Antiguo)</p></div>
                )}
                <div className="min-w-0"><span className="text-muted-foreground">Estado:</span><p className="flex items-center gap-2"><StatusBadge status={detailReq.status} />{detailReq.status === "aprobado" && (() => { const d = formatDateOnly(detailReq.updated_at); return d ? <span className="text-xs text-muted-foreground">· {d}</span> : null; })()}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground">Creado:</span><p className="font-medium truncate">{formatDateFull(detailReq.created_at)}</p></div>
                {detailReq.status !== "pendiente" && (
                  <div className="min-w-0"><span className="text-muted-foreground">Actualizado:</span><p className="font-medium truncate">{formatDateFull(detailReq.updated_at) ?? "—"}</p></div>
                )}
              </div>

              {isVacationRequest(detailReq) && (
                <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-teal-600 dark:text-teal-400">
                    <Palmtree className="h-4 w-4" />
                    <span>Registro de Vacaciones y Postergación de Arriendo</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Esta solicitud corresponde a tu período de vacaciones registrado desde el Dashboard. Incluye postergación de arriendo con recargo del 10% al retorno.
                  </p>
                </div>
              )}

              <div>
                <span className="text-muted-foreground block mb-1">Detalles de la solicitud:</span>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                  {stripResolution(detailReq.details) || "Sin detalles"}
                </div>
              </div>

              {parseResolution(detailReq.details) && (
                <div>
                  <span className="text-destructive block mb-1 font-medium flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Motivo del rechazo
                  </span>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm whitespace-pre-wrap break-all">
                    <p className="text-xs text-muted-foreground mb-1">{parseResolution(detailReq.details)?.date}</p>
                    {parseResolution(detailReq.details)?.reason}
                  </div>
                </div>
              )}

              {detailReq.status === "aprobado" && (
                <div>
                  <span className="text-green-600 block mb-1 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Aprobado
                  </span>
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDateOnly(detailReq.updated_at) ? `Fecha de aprobación: ${formatDateOnly(detailReq.updated_at)}` : "Fecha de aprobación: —"}</p>
                  </div>
                </div>
              )}

              {detailReq.status === "completado" && (
                <div>
                  <span className="text-green-600 block mb-1 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Completada
                  </span>
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Completada el {new Date(detailReq.updated_at).toLocaleString("es-CL")}</p>
                  </div>
                </div>
              )}

              {TERMINAL_STATUSES.includes(detailReq.status) && (
                <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Solicitud {detailReq.status}.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Editar Solicitud</DialogTitle></DialogHeader>
          {editReq && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de solicitud *</Label>
                <Select value={editTypeId} onValueChange={setEditTypeId} required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {availableEditTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehículo asociado</Label>
                <Select value={editVehicleId} onValueChange={setEditVehicleId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vehículo</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto estimado (CLP)</Label>
                <Input type="number" step="1" min="0" placeholder="Ej: 150000" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Detalles *</Label>
                <Textarea required placeholder="Describe tu solicitud..." maxLength={500} value={editDetails} onChange={(e) => setEditDetails(e.target.value)} className="resize-none" />
                <p className="text-xs text-muted-foreground text-right">{editDetails.length}/500</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={editLoading}>{editLoading ? "Guardando..." : "Guardar Cambios"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará esta solicitud de {deleteReq?.request_types?.name ?? "tipo"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive hover:text-destructive-foreground">
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
