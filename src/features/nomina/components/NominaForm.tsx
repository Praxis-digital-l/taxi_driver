import { useEffect, useMemo, useRef, useState } from "react";
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
  onGuardarPreliquidacion: (data: DatosNomina) => void;
  datosIniciales?: DatosNomina | null;
  idPreliquidacion?: string | null;
  guardandoPreliquidacion?: boolean;
  onCancelarEdicion?: () => void;
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

type OtroDescuento = {
  key: string;
  descripcion: string;
  monto: string;
};

function crearOtroDescuento(): OtroDescuento {
  return {
    key: `descuento_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    descripcion: "",
    monto: "",
  };
}

function leerAutopistasRecurrentes(): string[] {
  try {
    const raw = window.localStorage.getItem(AUTOPISTAS_RECURRENTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? (parsed as string[])
      : [];
  } catch {
    return [];
  }
}

function conductorDesdeDatos(datos: DatosNomina): ConductorRecord {
  return {
    id: datos.trabajadorId,
    user_id: "",
    nombres: datos.nombre,
    apellido_paterno: "",
    apellido_materno: "",
    full_name: datos.nombre || datos.trabajadorId,
    email: datos.email,
    phone: null,
    rut: datos.rut,
    worker_id: datos.trabajadorId,
    score: null,
    estado_conductor: datos.estadoConductor || "",
    photo_url: null,
    role: "conductor",
    created_at: "",
    updated_at: "",
  };
}

function vehiculoDesdeDatos(datos: DatosNomina): VehicleRecord | null {
  if (!datos.vehicle_id) return null;
  return {
    id: datos.vehicle_id,
    license_plate: datos.vehicle_plate || "",
    make: datos.vehicle_make ?? null,
    model: datos.vehicle_model ?? null,
    year: datos.vehicle_year ?? null,
    color: null,
    status: "",
  };
}

function inicializarEstadoForm(datos: DatosNomina | null | undefined) {
  const values: Record<string, string> = {};
  const monto = (valor: number | undefined) => (valor && valor > 0 ? formatPesos(String(valor)) : "");

  if (datos) {
    values.totalFacturado = monto(datos.totalFacturado);
    values.gastoOperacional = monto(datos.gastoOperacional);
    values.diesel = monto(datos.diesel);
    values.arriendo = monto(datos.arriendo);
    values.seguro = monto(datos.seguro);
    values.efectivoMonto = monto(datos.efectivoMonto);
    values.mantencion = monto(datos.mantencion);
    values.anticipo = monto(datos.anticipo);
    values.prestamo = monto(datos.prestamo);
  } else {
    values.arriendo = formatPesos(String(ARRIENDO_ESTANDAR));
  }

  const recurrentes = leerAutopistasRecurrentes();
  const autopistas = Object.entries(datos?.tag ?? {}).map(([label, valor]) => {
    const key = `autopista_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    values[key] = monto(valor);
    return { key, label, recurrente: recurrentes.includes(label) };
  });

  const descuentosGuardados = (datos?.descuentosExtra ?? []).map((descuento) => ({
    key: crearOtroDescuento().key,
    descripcion: descuento.descripcion,
    monto: monto(descuento.monto),
  }));

  return {
    values,
    autopistas,
    otrosDescuentos: descuentosGuardados.length > 0 ? descuentosGuardados : [crearOtroDescuento()],
  };
}

export default function NominaForm({
  onCalcular,
  onGuardarPreliquidacion,
  datosIniciales,
  idPreliquidacion,
  guardandoPreliquidacion = false,
  onCancelarEdicion,
}: NominaFormProps) {
  const estadoInicial = useMemo(() => inicializarEstadoForm(datosIniciales), [datosIniciales]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(estadoInicial.values);
  const [otrosDescuentos, setOtrosDescuentos] = useState<OtroDescuento[]>(estadoInicial.otrosDescuentos);
  const [conductores, setConductores] = useState<ConductorRecord[]>([]);
  const [selectedConductor, setSelectedConductor] = useState<ConductorRecord | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignmentRecord[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);
  const [autopistas, setAutopistas] = useState<Array<{ key: string; label: string; recurrente: boolean }>>(estadoInicial.autopistas);
  const [agregando, setAgregando] = useState(false);
  const [nuevaAutopistaNombre, setNuevaAutopistaNombre] = useState("");
  const [dialogAutopistaAbierto, setDialogAutopistaAbierto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const datosInicialesAplicadosRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedAutopistas = window.localStorage.getItem(AUTOPISTAS_RECURRENTES_STORAGE_KEY);
      if (storedAutopistas) {
        const nombres = JSON.parse(storedAutopistas) as unknown;
        if (!Array.isArray(nombres) || !nombres.every((nombre) => typeof nombre === "string")) {
          throw new Error("El formato de las autopistas recurrentes no es válido.");
        }
        if (datosIniciales) {
          setAutopistas((prev) => prev.map((autopista) => ({
            ...autopista,
            recurrente: nombres.includes(autopista.label),
          })));
        } else {
          setAutopistas(nombres.map((label) => ({
            key: `autopista_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            label,
            recurrente: true,
          })));
        }
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
  }, [toast, datosIniciales]);

  useEffect(() => {
    if (!datosIniciales) return;

    if (!datosInicialesAplicadosRef.current) {
      datosInicialesAplicadosRef.current = true;
      setSelectedConductor(conductorDesdeDatos(datosIniciales));
      const vehiculoInicial = vehiculoDesdeDatos(datosIniciales);
      if (vehiculoInicial) setSelectedVehicle(vehiculoInicial);
    }

    const conductorCatalogo = conductores.find(
      (item) => item.id === datosIniciales.trabajadorId || item.worker_id === datosIniciales.trabajadorId
    );
    if (conductorCatalogo) {
      setSelectedConductor((prev) => (
        prev && prev.id !== datosIniciales.trabajadorId ? prev : conductorCatalogo
      ));
    }

    const vehiculoCatalogo = vehicles.find((item) => item.id === datosIniciales.vehicle_id);
    if (vehiculoCatalogo) {
      setSelectedVehicle((prev) => (
        prev && prev.id !== datosIniciales.vehicle_id ? prev : vehiculoCatalogo
      ));
    }
  }, [datosIniciales, conductores, vehicles]);

  const handleCurrencyChange = (id: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, [id]: digits ? formatPesos(digits) : "" }));
  };

  const agregarOtroDescuento = () => {
    setOtrosDescuentos((prev) => [...prev, crearOtroDescuento()]);
  };

  const eliminarOtroDescuento = (key: string) => {
    setOtrosDescuentos((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.key !== key)));
  };

  const actualizarOtroDescuento = (key: string, campo: "descripcion" | "monto", value: string) => {
    setOtrosDescuentos((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        if (campo === "monto") {
          const digits = value.replace(/\D/g, "");
          return { ...d, monto: digits ? formatPesos(digits) : "" };
        }
        return { ...d, descripcion: value };
      })
    );
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

  const construirDatosNomina = (): DatosNomina => {
    const parseNum = (key: string): number => {
      const digits = (values[key] || "").replace(/\D/g, "");
      return digits ? parseInt(digits, 10) : 0;
    };

    const tag = crearDescuentosTAG();
    for (const { key, label } of autopistas) {
      tag[label] = parseNum(key);
    }

    return {
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
      descuentosExtra: otrosDescuentos.map(({ descripcion, monto }) => ({
        descripcion: descripcion.trim(),
        monto: parseNum(monto),
      })),
      efectivoMonto: parseNum("efectivoMonto"),
      vehicle_id: selectedVehicle?.id || "",
      vehicle_plate: selectedVehicle?.license_plate || "",
      vehicle_make: selectedVehicle?.make || null,
      vehicle_model: selectedVehicle?.model || null,
      vehicle_year: selectedVehicle?.year || null,
    };
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = construirDatosNomina();
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

  const handleGuardarPreliquidacion = () => {
    const datos = construirDatosNomina();
    const erroresBasicos: Record<string, string> = {};

    if (!datos.trabajadorId) {
      erroresBasicos.trabajadorId = "Selecciona un conductor para identificar la preliquidación.";
    }
    if (!datos.vehicle_id) {
      erroresBasicos.vehiculo = "Selecciona un vehículo para identificar la preliquidación.";
    }

    if (Object.keys(erroresBasicos).length > 0) {
      setErrores((prev) => ({ ...prev, ...erroresBasicos }));
      toast({
        title: "No se pudo guardar la preliquidación",
        description: "Necesitas seleccionar conductor y vehículo; el resto de los datos puede quedar incompleto.",
        variant: "destructive",
      });
      return;
    }

    setErrores({});
    onGuardarPreliquidacion(datos);
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
      {idPreliquidacion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <Bookmark className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Preliquidación en edición</p>
              <p className="mt-0.5">
                Puedes completar los datos faltantes y luego firmarla o dejarla pendiente de firma.
              </p>
            </div>
          </div>
          {onCancelarEdicion && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancelarEdicion}>
              Salir de la edición
            </Button>
          )}
        </div>
      )}

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
                if (!value) return;
                const cond = conductores.find((c) => c.id === value)
                  ?? (selectedConductor?.id === value ? selectedConductor : null);
                setSelectedConductor(cond);
              }}
            >
              <SelectTrigger className={errores.trabajadorId ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar conductor..." />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const opciones = selectedConductor ? [selectedConductor] : [];
                  conductores.forEach((conductor) => {
                    if (!opciones.some((item) => item.id === conductor.id)) opciones.push(conductor);
                  });
                  return opciones.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.worker_id ? `${c.worker_id} — ` : ""}{c.full_name}
                    </SelectItem>
                  ));
                })()}
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
                  if (!value) return;
                  if (!selectedConductor) {
                    setErrores((prev) => ({ ...prev, vehiculo: "Primero debe seleccionar un conductor" }));
                    return;
                  }
                  const veh = vehicles.find((v) => v.id === value)
                    ?? (selectedVehicle?.id === value ? selectedVehicle : null);
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
                    const opciones: VehicleRecord[] = [];
                    if (selectedVehicle) opciones.push(selectedVehicle);
                    if (selectedConductor) {
                      const assignedVehicleIds = assignments
                        .filter((a) => a.profile_id === selectedConductor.id)
                        .map((a) => a.vehicle_id);
                      vehicles.forEach((vehiculo) => {
                        if (assignedVehicleIds.includes(vehiculo.id) && !opciones.some((item) => item.id === vehiculo.id)) {
                          opciones.push(vehiculo);
                        }
                      });
                    }
                    if (opciones.length === 0) {
                      return <SelectItem value="none" disabled>Sin vehículos asignados</SelectItem>;
                    }
                    return opciones.map((v) => (
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
              {selectedConductor && !selectedVehicle && (() => {
                const assignedVehicleIds = assignments
                  .filter((a) => a.profile_id === selectedConductor.id)
                  .map((a) => a.vehicle_id);
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
        <CardContent className="space-y-4">
          {otrosDescuentos.map(({ key, descripcion, monto }) => (
            <div key={key} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`${key}-descripcion`}>Descripción</Label>
                <Input
                  id={`${key}-descripcion`}
                  type="text"
                  value={descripcion}
                  onChange={(e) => actualizarOtroDescuento(key, "descripcion", e.target.value)}
                  placeholder="Ej: Multa, cobro administrativo"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`${key}-monto`}>Monto</Label>
                  {otrosDescuentos.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar descuento"
                      onClick={() => eliminarOtroDescuento(key)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  id={`${key}-monto`}
                  type="text"
                  inputMode="numeric"
                  value={monto}
                  onChange={(e) => actualizarOtroDescuento(key, "monto", e.target.value)}
                  placeholder="Ej: 20.000"
                  className={SPINNER_HIDE}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={agregarOtroDescuento}
          >
            <Plus className="h-4 w-4" />
            Agregar descuento
          </Button>
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

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleGuardarPreliquidacion}
          disabled={guardandoPreliquidacion || (!!datosIniciales && !selectedConductor)}
          className="gap-2"
        >
          <Bookmark className="h-4 w-4" />
          {guardandoPreliquidacion
            ? "Guardando..."
            : idPreliquidacion
              ? "Actualizar preliquidación"
              : "Guardar preliquidación"}
        </Button>
        <Button type="submit" size="lg" className="gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
          <Calculator className="h-5 w-5" />
          {idPreliquidacion ? "Completar preliquidación" : "Calcular nómina"}
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
