import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Check,
  DollarSign,
  UserRound,
  Mail,
  Fingerprint,
  Plus,
  X,
  Star,
  Clock,
  Bookmark,
  Info,
  Truck,
} from "lucide-react";
import {
  type DatosNomina,
  type DescuentosTAG,
  ARRIENDO_ESTANDAR,
  crearDescuentosTAG,
  validarDatosNomina,
} from "@/lib/nomina";
import { fetchAdminConductores, type ConductorRecord } from "@/features/admin/services/adminConductoresService";
import {
  fetchAdminVehiclesData,
  type VehicleRecord,
  type VehicleAssignmentRecord,
} from "@/features/admin/services/adminVehiclesService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface NominaFormProps {
  onCalcular: (data: DatosNomina) => void;
}

const SPINNER_HIDE = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
const AUTOPISTAS_RECURRENTES_STORAGE_KEY = "nomina.autopistas-recurrentes";

const CAMPOS_BASE = [
  { id: "totalFacturado", label: "Total facturado", placeholder: "Ej: 1.500.000" },
  { id: "gastoOperacional", label: "Gasto operacional", placeholder: "Ej: 100.000" },
  { id: "diesel", label: "Diesel", placeholder: "Ej: 200.000" },
  { id: "arriendo", label: "Arriendo", placeholder: "Ej: 150.000" },
  { id: "seguro", label: "Seguro", placeholder: "Ej: 50.000" },
  { id: "efectivoMonto", label: "Efectivo", placeholder: "Ej: 30.000" },
] as const;

const CAMPOS_SECUNDARIOS = [
  { id: "mantencion", label: "Mantención", placeholder: "Ej: 80.000" },
  { id: "anticipo", label: "Anticipo", placeholder: "Ej: 100.000" },
  { id: "prestamo", label: "Préstamo", placeholder: "Ej: 50.000" },
  { id: "efectivoMonto", label: "Efectivo", placeholder: "Ej: 30.000" },
] as const;

function formatPesos(digits: string): string {
  if (!digits) return "";
  return `$ ${Number(digits).toLocaleString("es-CL")}`;
}

export default function NominaForm({ onCalcular }: NominaFormProps) {
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(() => ({
    arriendo: formatPesos(String(ARRIENDO_ESTANDAR)),
  }));
  const [conductores, setConductores] = useState<ConductorRecord[]>([]);
  const [selectedConductor, setSelectedConductor] = useState<ConductorRecord | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignmentRecord[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);
  const [autopistas, setAutopistas] = useState<Array<{ key: string; label: string; recurrente: boolean }>>([]);
  const [agregando, setAgregando] = useState(false);
  const [nuevaAutopistaNombre, setNuevaAutopistaNombre] = useState("");
  const [dialogAutopistaAbierto, setDialogAutopistaAbierto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedAutopistas = window.localStorage.getItem(AUTOPISTAS_RECURRENTES_STORAGE_KEY);
      if (storedAutopistas) {
        const nombres = JSON.parse(storedAutopistas) as unknown;
        if (!Array.isArray(nombres) || !nombres.every((nombre) => typeof nombre === "string")) {
          throw new Error("El formato de las autopistas recurrentes no es válido.");
        }
        setAutopistas(nombres.map((label) => ({
          key: `autopista_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          label,
          recurrente: true,
        })));
      }
    } catch (error) {
      toast({
        title: "No se pudieron cargar las autopistas recurrentes",
        description: error instanceof Error ? error.message : "Revisa el almacenamiento local del navegador.",
        variant: "destructive",
      });
    }

    fetchAdminConductores()
      .then((data) => setConductores(data))
      .catch(() => {});
    fetchAdminVehiclesData()
      .then((data) => {
        setVehicles(data.vehicles || []);
        setAssignments(data.assignments || []);
      })
      .catch(() => {});
  }, [toast]);

  const handleCurrencyChange = (id: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, [id]: digits ? formatPesos(digits) : "" }));
  };

  const iniciarAgregar = () => {
    setNuevaAutopistaNombre("");
    setAgregando(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirmarAgregar = () => {
    const nombre = nuevaAutopistaNombre.trim();
    if (!nombre) return;
    if (autopistas.some((a) => a.label.toLocaleLowerCase("es-CL") === nombre.toLocaleLowerCase("es-CL"))) {
      toast({
        title: "Autopista ya agregada",
        description: `${nombre} ya está en el desglose TAG.`,
      });
      return;
    }
    setDialogAutopistaAbierto(true);
  };

  const agregarAutopista = (recurrente: boolean) => {
    const nombre = nuevaAutopistaNombre.trim();
    if (!nombre) return;
    let guardarComoRecurrente = recurrente;
    if (recurrente) {
      try {
        const nombresRecurrentes = autopistas.filter((autopista) => autopista.recurrente).map((autopista) => autopista.label);
        window.localStorage.setItem(
          AUTOPISTAS_RECURRENTES_STORAGE_KEY,
          JSON.stringify([...nombresRecurrentes, nombre])
        );
      } catch (error) {
        guardarComoRecurrente = false;
        toast({
          title: "No se pudo guardar como recurrente",
          description: error instanceof Error ? error.message : "La autopista se agregará solo a este cálculo.",
          variant: "destructive",
        });
      }
    }

    const key = `autopista_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setAutopistas((prev) => [...prev, { key, label: nombre, recurrente: guardarComoRecurrente }]);
    setValues((prev) => ({ ...prev, [key]: "" }));
    setNuevaAutopistaNombre("");
    setAgregando(false);
    setDialogAutopistaAbierto(false);
  };

  const cancelarAgregar = () => {
    setNuevaAutopistaNombre("");
    setAgregando(false);
    setDialogAutopistaAbierto(false);
  };

  const eliminarAutopista = (key: string, label?: string) => {
    const autopista = autopistas.find((item) => item.key === key);
    if (autopista?.recurrente) {
      try {
        window.localStorage.setItem(
          AUTOPISTAS_RECURRENTES_STORAGE_KEY,
          JSON.stringify(autopistas.filter((item) => item.key !== key && item.recurrente).map((item) => item.label))
        );
      } catch (error) {
        toast({
          title: "No se pudo quitar la autopista recurrente",
          description: error instanceof Error ? error.message : "La autopista podría volver a aparecer en el próximo cálculo.",
          variant: "destructive",
        });
      }
    }
    setAutopistas((prev) => prev.filter((a) => a.key !== key));
    setValues((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    setErrores((prev) => {
      const next = { ...prev };
      delete next[`tag.${key}`];
      if (label) delete next[`tag.${label}`];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const parseNum = (key: string): number => {
      const raw = values[key] || "";
      const digits = raw.replace(/\D/g, "");
      return digits ? parseInt(digits, 10) : 0;
    };

    const tag = crearDescuentosTAG();
    for (const { key, label } of autopistas) {
      tag[label] = parseNum(key);
    }

    if (!selectedVehicle) {
      setErrores((prev) => ({ ...prev, vehiculo: "Debe seleccionar el vehículo con el cual se realizará esta liquidación." }));
      return;
    }

    const data: DatosNomina = {
      trabajadorId: selectedConductor?.worker_id || selectedConductor?.id || "",
      nombre: selectedConductor?.full_name || "",
      email: selectedConductor?.email || "",
      rut: selectedConductor?.rut || "",
      estadoConductor: selectedConductor?.estado_conductor,
      totalFacturado: parseNum("totalFacturado"),
      gastoOperacional: parseNum("gastoOperacional"),
      diesel: parseNum("diesel"),
      tag,
      arriendo: parseNum("arriendo"),
      seguro: parseNum("seguro"),
      mantencion: parseNum("mantencion"),
      anticipo: parseNum("anticipo"),
      prestamo: parseNum("prestamo"),
      otroDescuentoDescripcion: (values.otroDescuentoDescripcion || "").trim(),
      otroDescuentoMonto: parseNum("otroDescuentoMonto"),
      efectivoMonto: parseNum("efectivoMonto"),
      vehicle_id: selectedVehicle.id,
      vehicle_plate: selectedVehicle.license_plate,
      vehicle_make: selectedVehicle.make,
      vehicle_model: selectedVehicle.model,
      vehicle_year: selectedVehicle.year,
    };

    const validationErrors = validarDatosNomina(data);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      for (const err of validationErrors) {
        errorMap[err.campo] = err.mensaje;
      }
      setErrores(errorMap);
      return;
    }

    setErrores({});
    onCalcular(data);
  };

  const renderCurrencyInput = (campo: { id: string; label: string; placeholder: string }) => (
    <div key={campo.id} className="space-y-1">
      <Label htmlFor={campo.id}>{campo.label}</Label>
      <Input
        id={campo.id}
        name={campo.id}
        type="text"
        inputMode="numeric"
        value={values[campo.id] || ""}
        onChange={(e) => handleCurrencyChange(campo.id, e.target.value)}
        placeholder={campo.placeholder}
        className={`${SPINNER_HIDE} ${errores[campo.id] ? "border-destructive" : ""}`}
      />
      {errores[campo.id] && (
        <p className="text-xs text-destructive">{errores[campo.id]}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <DollarSign className="h-4 w-4" />
            </div>
            Datos del trabajador
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="trabajadorId">ID del trabajador</Label>
            <Select
              name="trabajadorId"
              value={selectedConductor?.id || ""}
              onValueChange={(value) => {
                const cond = conductores.find((c) => c.id === value);
                setSelectedConductor(cond || null);
              }}
            >
              <SelectTrigger className={errores.trabajadorId ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar conductor..." />
              </SelectTrigger>
              <SelectContent>
                {conductores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.worker_id ? `${c.worker_id} — ` : ""}{c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errores.trabajadorId && (
              <p className="text-xs text-destructive">{errores.trabajadorId}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vista previa</Label>
            {selectedConductor ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 h-[70px] dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-heading font-medium text-sm truncate text-slate-900 dark:text-slate-100">{selectedConductor.full_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {selectedConductor.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Fingerprint className="h-3 w-3" /> {selectedConductor.rut}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Truck className="h-4 w-4" />
              </div>
              Vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="vehiculo">Vehículo *</Label>
              <Select
                name="vehiculo"
                value={selectedVehicle?.id || ""}
                onValueChange={(value) => {
                  if (!selectedConductor) {
                    setErrores((prev) => ({ ...prev, vehiculo: "Primero debe seleccionar un conductor" }));
                    return;
                  }
                  const condProfileId = (selectedConductor as any).id || (selectedConductor as any).profile_id;
                  const assignment = assignments.find((a: any) => (a.profile_id === condProfileId || a.profiles?.id === condProfileId) && a.vehicle_id === value);
                  if (!assignment) {
                    // try match by vehicle id anyway
                  }
                  const veh = vehicles.find((v) => v.id === value) || null;
                  setSelectedVehicle(veh);
                  setErrores((prev) => {
                    const next = { ...prev };
                    delete next.vehiculo;
                    return next;
                  });
                }}
                disabled={!selectedConductor}
              >
                <SelectTrigger className={errores.vehiculo ? "border-destructive" : ""}>
                  <SelectValue placeholder={selectedConductor ? "Seleccionar vehículo..." : "Primero seleccione un conductor"} />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    if (!selectedConductor) return null;
                    const condProfileId = (selectedConductor as any).id || (selectedConductor as any).profile_id;
                    const assignedVehicleIds = assignments
                      .filter((a: any) => a.profile_id === condProfileId || a.profiles?.id === condProfileId)
                      .map((a: any) => a.vehicle_id);
                    const assigned = vehicles.filter((v) => assignedVehicleIds.includes(v.id));
                    if (assigned.length === 0) {
                      return <SelectItem value="none" disabled>Sin vehículos asignados</SelectItem>;
                    }
                    return assigned.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.license_plate} | {v.make} {v.model} {v.year ? v.year : ""}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
              {errores.vehiculo && (
                <p className="text-xs text-destructive">{errores.vehiculo}</p>
              )}
              {selectedConductor && (() => {
                const condProfileId = (selectedConductor as any).id || (selectedConductor as any).profile_id;
                const assignedVehicleIds = assignments
                  .filter((a: any) => a.profile_id === condProfileId || a.profiles?.id === condProfileId)
                  .map((a: any) => a.vehicle_id);
                const assigned = vehicles.filter((v) => assignedVehicleIds.includes(v.id));
                if (assigned.length === 0) {
                  return <p className="text-xs text-amber-600">Este conductor no tiene vehículos asignados. Asignarle uno desde Gestión de Vehículos.</p>;
                }
                return null;
              })()}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vista previa</Label>
              {selectedVehicle ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 h-[70px] dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-heading font-medium text-sm truncate text-slate-900 dark:text-slate-100">{selectedVehicle.license_plate}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year ? `(${selectedVehicle.year})` : ""}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg bg-muted/20 h-[70px]">
                  <p className="text-xs text-muted-foreground italic">Seleccione un vehículo</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>



      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <DollarSign className="h-4 w-4" />
            </div>
            Ingresos y descuentos primarios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_BASE.map(renderCurrencyInput)}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <DollarSign className="h-4 w-4" />
            </div>
            Otros descuentos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="otroDescuentoDescripcion">Descripción</Label>
            <Input
              id="otroDescuentoDescripcion"
              name="otroDescuentoDescripcion"
              type="text"
              value={values.otroDescuentoDescripcion || ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, otroDescuentoDescripcion: e.target.value }))
              }
              placeholder="Ej: Multa, cobro administrativo"
            />
          </div>
          {renderCurrencyInput({ id: "otroDescuentoMonto", label: "Monto", placeholder: "Ej: 20.000" })}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <DollarSign className="h-4 w-4" />
            </div>
            TAG - Desglose por autopista
          </CardTitle>
        </CardHeader>
        <CardContent>
          {autopistas.length === 0 ? (
            agregando ? (
              <div className="mx-auto max-w-sm space-y-1">
                <Input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  value={nuevaAutopistaNombre}
                  onChange={(e) => setNuevaAutopistaNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmarAgregar();
                    } else if (e.key === "Escape") {
                      cancelarAgregar();
                    }
                  }}
                  placeholder="Ej: Autopista Central"
                  className="bg-muted/40 placeholder:text-muted-foreground/70"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="gap-1" onClick={confirmarAgregar}>
                    <Check className="h-4 w-4" />
                    Confirmar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={cancelarAgregar}>
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">Aún no hay autopistas registradas</p>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={iniciarAgregar}>
                  <Plus className="h-4 w-4" />
                  Agregar autopista
                </Button>
              </div>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {autopistas.map(({ key, label }) => {
                const errorTAG = errores[`tag.${label}`] || errores[`tag.${key}`];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={key} className="truncate">{label}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${label}`}
                        onClick={() => eliminarAutopista(key, label)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      id={key}
                      name={key}
                      type="text"
                      inputMode="numeric"
                      value={values[key] || ""}
                      onChange={(e) => handleCurrencyChange(key, e.target.value)}
                      placeholder="0"
                      className={`${SPINNER_HIDE} ${errorTAG ? "border-destructive" : ""}`}
                    />
                    {errorTAG && (
                      <p className="text-xs text-destructive">{errorTAG}</p>
                    )}
                  </div>
                );
              })}

              <div className="flex items-end">
                {agregando ? (
                  <div className="w-full space-y-2">
                    <Input
                      ref={inputRef}
                      type="text"
                      autoFocus
                      value={nuevaAutopistaNombre}
                      onChange={(e) => setNuevaAutopistaNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmarAgregar();
                        } else if (e.key === "Escape") {
                          cancelarAgregar();
                        }
                      }}
                      placeholder="Ej: Autopista Central"
                      className="bg-muted/40 placeholder:text-muted-foreground/70"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="gap-1" onClick={confirmarAgregar}>
                        <Check className="h-4 w-4" />
                        Confirmar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={cancelarAgregar}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={iniciarAgregar}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar autopista
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <DollarSign className="h-4 w-4" />
            </div>
            Descuentos secundarios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {CAMPOS_SECUNDARIOS.map(renderCurrencyInput)}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
          <Calculator className="h-5 w-5" />
          Calcular nómina
        </Button>
      </div>

      <Dialog open={dialogAutopistaAbierto} onOpenChange={setDialogAutopistaAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Mantener autopista recurrente?</DialogTitle>
            <DialogDescription>
              ¿Quieres guardar “{nuevaAutopistaNombre.trim()}” para que aparezca también en próximos cálculos de nómina?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => agregarAutopista(false)}>
              No, solo esta vez
            </Button>
            <Button type="button" onClick={() => agregarAutopista(true)}>
              Sí, mantener recurrente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
