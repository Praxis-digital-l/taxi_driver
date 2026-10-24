import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import type { VehicleRecord } from "@/features/admin/services/adminVehiclesService";
import type { LiquidacionRecord } from "@/features/nomina/services/liquidacionesService";
import {
  fetchRendimientoActivosData,
  obtenerDocumentosVehiculoPeriodo,
  obtenerNominaVehiculoPeriodo,
  obtenerPeriodoLiquidacion,
  obtenerProrrateoVehiculoPeriodo,
  upsertVehicleProrrateo,
  type AssetDocument,
  type ProrrateoRecord,
} from "@/features/admin/services/rendimientoActivosService";
import {
  ARRIENDO_ESTANDAR,
  MESES,
  calcularRendimientoActivo,
  documentoGeneraGasto,
  esDocumentoRepuesto,
  esDocumentoRevisionTecnica,
  formatearPeriodo,
  formatMontoInput,
  parseMontoInput,
  periodoDesdeFechaRegistro,
  type PeriodoRendimiento,
} from "@/lib/rendimientoActivos";
import {
  Calendar,
  FileText,
  RefreshCw,
  Save,
  ShieldCheck,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";

const formatCLP = (val: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(val || 0);

function fechaLocalISO(fecha: Date): string {
  const offset = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function FilaValor({
  label,
  detalle,
  valor,
  destacado = false,
}: {
  label: string;
  detalle?: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
      </div>
      <span className={`font-mono text-sm shrink-0 ${destacado ? "font-bold" : "font-semibold"}`}>
        {formatCLP(valor)}
      </span>
    </div>
  );
}

export default function AdminRendimientoActivos() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [documentos, setDocumentos] = useState<AssetDocument[]>([]);
  const [prorrateos, setProrrateos] = useState<ProrrateoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoRendimiento & { todos?: boolean }>(() => ({
    ...periodoDesdeFechaRegistro(new Date()),
    todos: false,
  }));
  const [fechaRegistro, setFechaRegistro] = useState(() => fechaLocalISO(new Date()));
  const [prorrateoInput, setProrrateoInput] = useState("");

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await fetchRendimientoActivosData();
      setVehicles(data.vehicles);
      setLiquidaciones(data.liquidaciones);
      setDocumentos(data.documentos);
      setProrrateos(data.prorrateos);
      setSelectedVehicleId((prev) => prev || data.vehicles[0]?.id || "");
    } catch (error) {
      toast({
        title: "No se pudo cargar Rendimiento de Activos",
        description:
          error instanceof Error
            ? error.message
            : "Verifica que la migración de base de datos esté aplicada.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehicle = useMemo(
    () => vehicles.find((item) => item.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  const periodoAplicado = useMemo(
    () => periodoDesdeFechaRegistro(fechaRegistro),
    [fechaRegistro]
  );

  const prorrateoRecord = useMemo(
    () =>
      selectedVehicleId
        ? obtenerProrrateoVehiculoPeriodo(prorrateos, selectedVehicleId, periodo)
        : null,
    [prorrateos, selectedVehicleId, periodo]
  );

  useEffect(() => {
    setProrrateoInput(prorrateoRecord ? formatMontoInput(prorrateoRecord.monto) : "");
  }, [prorrateoRecord]);

  const nominaAcumulada = useMemo(() => {
    if (!selectedVehicleId) return null;
    if (periodo.todos) {
      let arriendo = 0;
      let seguroTotal = 0;
      let mantencion = 0;
      let tieneNomina = false;
      let liquidacionId: string | null = null;
      let fechaCalculo: string | null = null;
      for (let i = 0; i < liquidaciones.length; i++) {
        const liq = liquidaciones[i];
        if (liq.vehicle_id !== selectedVehicleId) continue;
        const p = obtenerPeriodoLiquidacion(liq);
        if (p.anio !== periodo.anio) continue;
        const nom = obtenerNominaVehiculoPeriodo(liquidaciones, selectedVehicleId, p);
        if (nom.tieneNomina) {
          tieneNomina = true;
          arriendo += nom.arriendo || 0;
          seguroTotal += nom.seguroTotal || 0;
          mantencion += nom.mantencion || 0;
          if (!liquidacionId && nom.liquidacionId) liquidacionId = nom.liquidacionId;
          if (!fechaCalculo && nom.fechaCalculo) fechaCalculo = nom.fechaCalculo;
        }
      }
      return { arriendo, seguroTotal, mantencion, tieneNomina, liquidacionId, fechaCalculo };
    }
    return obtenerNominaVehiculoPeriodo(liquidaciones, selectedVehicleId, periodo);
  }, [liquidaciones, selectedVehicleId, periodo]);

  const nomina = nominaAcumulada;

  const documentosPeriodo = useMemo(() => {
    if (!selectedVehicleId) return { revisionTecnica: 0, repuestos: 0, detalle: [] as AssetDocument[] };
    if (periodo.todos) {
      const detalle: AssetDocument[] = [];
      for (let i = 0; i < documentos.length; i++) {
        const doc = documentos[i];
        if (doc.vehicle_id !== selectedVehicleId) continue;
        const fecha = new Date(doc.created_at);
        if (Number.isNaN(fecha.getTime())) continue;
        if (fecha.getFullYear() !== periodo.anio) continue;
        if (esDocumentoRepuesto(doc.document_type_name) || esDocumentoRevisionTecnica(doc.document_type_name)) {
          detalle.push(doc);
        }
      }
      let revisionTecnica = 0;
      let repuestos = 0;
      for (let i = 0; i < detalle.length; i++) {
        const doc = detalle[i];
        if (esDocumentoRepuesto(doc.document_type_name)) repuestos += Number(doc.amount) || 0;
        else if (esDocumentoRevisionTecnica(doc.document_type_name)) revisionTecnica += Number(doc.amount) || 0;
      }
      return { revisionTecnica, repuestos, detalle };
    }
    return obtenerDocumentosVehiculoPeriodo(documentos, selectedVehicleId, periodo);
  }, [documentos, selectedVehicleId, periodo]);

  const prorrateoAcumulado = useMemo(() => {
    if (!selectedVehicleId) return 0;
    if (periodo.todos) {
      let total = 0;
      for (let i = 0; i < prorrateos.length; i++) {
        const p = prorrateos[i];
        if (p.vehicle_id === selectedVehicleId && p.anio_rendimiento === periodo.anio) {
          total += Number(p.monto) || 0;
        }
      }
      return total;
    }
    return prorrateoRecord?.monto || 0;
  }, [prorrateos, selectedVehicleId, periodo, prorrateoRecord]);

  const resultado = useMemo(
    () =>
      calcularRendimientoActivo({
        arriendo: nomina?.arriendo ?? 0,
        seguroTotal: nomina?.seguroTotal ?? 0,
        mantencion: nomina?.mantencion ?? 0,
        prorrateo: prorrateoAcumulado,
        revisionTecnica: documentosPeriodo.revisionTecnica,
        repuestos: documentosPeriodo.repuestos,
      }),
    [nomina, prorrateoAcumulado, documentosPeriodo]
  );

  const aniosDisponibles = useMemo(() => {
    const anios = new Set<number>([
      new Date().getFullYear(),
      periodo.anio,
      periodoAplicado.anio,
    ]);
    liquidaciones.forEach((liq) => {
      const fecha = new Date(liq.created_at);
      if (!Number.isNaN(fecha.getTime())) anios.add(fecha.getFullYear());
    });
    documentos.forEach((doc) => {
      const fecha = new Date(doc.created_at);
      if (!Number.isNaN(fecha.getTime())) anios.add(fecha.getFullYear());
    });
    return Array.from(anios).sort((a, b) => b - a);
  }, [liquidaciones, documentos, periodo.anio, periodoAplicado.anio]);

  const handleGuardarProrrateo = async () => {
    if (!selectedVehicleId) return;

    setGuardando(true);
    try {
      const guardado = await upsertVehicleProrrateo({
        vehicleId: selectedVehicleId,
        monto: parseMontoInput(prorrateoInput),
        fechaRegistro,
        periodo: periodoAplicado,
      });

      setProrrateos((prev) => [
        ...prev.filter(
          (item) =>
            !(
              item.vehicle_id === guardado.vehicle_id &&
              item.anio_rendimiento === guardado.anio_rendimiento &&
              item.mes_rendimiento === guardado.mes_rendimiento
            )
        ),
        guardado,
      ]);
      setPeriodo(periodoAplicado);
      setProrrateoInput(formatMontoInput(guardado.monto));

      toast({
        title: "Prorrateo Permiso de circulacion guardado",
        description: `Aplicado al rendimiento de ${formatearPeriodo(periodoAplicado)}.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo guardar Prorrateo Permiso de circulacion",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  const documentosConGasto = documentosPeriodo.detalle.filter((doc) =>
    documentoGeneraGasto(doc.document_type_name)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rendimiento de Activos"
        description="Rendimiento individual por vehículo a partir del arriendo y sus descuentos asociados"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="gap-1.5 text-xs h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </PageHeader>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-3.5 rounded-xl border bg-card shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5">
          <div className="w-full sm:w-64">
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger className="h-9 text-xs">
                <Truck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Seleccionar vehículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.license_plate}
                    {item.make || item.model
                      ? ` — ${[item.make, item.model].filter(Boolean).join(" ")}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={periodo.todos ? "todos" : String(periodo.mes)}
              onValueChange={(value) => {
                if (value === "todos") {
                  setPeriodo((prev) => ({ ...prev, todos: true }));
                } else {
                  setPeriodo((prev) => ({ ...prev, mes: Number(value), todos: false }));
                }
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {MESES.map((mes, index) => (
                  <SelectItem key={mes} value={String(index + 1)} className="capitalize">
                    {mes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-28">
            <Select
              value={String(periodo.anio)}
              onValueChange={(value) =>
                setPeriodo((prev) => ({ ...prev, anio: Number(value), todos: prev.todos }))
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {aniosDisponibles.map((anio) => (
                  <SelectItem key={anio} value={String(anio)}>
                    {anio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Badge variant="secondary" className="self-start lg:self-auto font-mono text-xs capitalize">
          {periodo.todos ? `Todos los meses ${periodo.anio}` : formatearPeriodo(periodo)}
        </Badge>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          Cargando rendimiento de activos...
        </div>
      ) : !vehicle ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay vehículos registrados para consultar.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-sm">
            <CardHeader className="border-b pb-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    {vehicle.license_plate}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {[vehicle.make, vehicle.model, vehicle.year ? `(${vehicle.year})` : ""]
                      .filter(Boolean)
                      .join(" ") || "Vehículo sin descripción"}
                    {" · "}
                    <span className="capitalize">{formatearPeriodo(periodo)}</span>
                  </CardDescription>
                </div>
                <Badge
                  variant={resultado.rendimiento >= 0 ? "outline" : "destructive"}
                  className={
                    resultado.rendimiento >= 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono"
                      : "font-mono"
                  }
                >
                  Rendimiento {formatCLP(resultado.rendimiento)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <FilaValor
                  label="Arriendo"
                  detalle={
                    nomina?.tieneNomina
                      ? periodo.todos
                        ? `Heredado de las nóminas del año ${periodo.anio}`
                        : `Heredado de la nómina de ${formatearPeriodo(periodo)}`
                      : `Sin nómina del período`
                  }
                  valor={resultado.arriendo}
                />
                <FilaValor
                  label="Seguro"
                  detalle={`50% de ${formatCLP(resultado.seguroTotal)}`}
                  valor={resultado.seguroDescontado}
                />
                <FilaValor
                  label="Mantención"
                  detalle="Valor completo desde nómina"
                  valor={resultado.mantencion}
                />
                <FilaValor
                  label="Prorrateo Permiso de circulacion"
                  detalle="Registro manual del módulo"
                  valor={resultado.prorrateo}
                />
                <FilaValor
                  label="Revisión técnica"
                  detalle="Documentos del vehículo en el período"
                  valor={resultado.revisionTecnica}
                />
                <FilaValor
                  label="Repuestos"
                  detalle="Documentos del vehículo en el período"
                  valor={resultado.repuestos}
                />
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-semibold">Rendimiento del vehículo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Arriendo − Seguro − Mantención − Prorrateo − Revisión técnica − Repuestos
                  </p>
                </div>
                <span
                  className={`font-mono text-2xl font-bold ${
                    resultado.rendimiento >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatCLP(resultado.rendimiento)}
                </span>
              </div>

              {documentosConGasto.length > 0 && (
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Documentos considerados
                  </p>
                  <div className="space-y-1.5">
                    {documentosConGasto.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{doc.document_type_name}</span>
                          <span className="text-muted-foreground">
                            {" · "}
                            {new Date(doc.created_at).toLocaleDateString("es-CL")}
                            {doc.description ? ` · ${doc.description}` : ""}
                          </span>
                        </div>
                        <span className="font-mono font-semibold shrink-0">
                          {formatCLP(doc.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b pb-3.5">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Prorrateo Permiso de circulacion
              </CardTitle>
              <CardDescription className="text-xs">
                El valor se aplica al rendimiento del mes de la fecha de registro.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prorrateo">Monto Prorrateo Permiso de circulacion</Label>
                  <Input
                    id="prorrateo"
                    inputMode="numeric"
                    value={prorrateoInput}
                    onChange={(event) =>
                      setProrrateoInput(formatMontoInput(event.target.value))
                    }
                    placeholder="Ej: $ 50.000"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fechaRegistro">Fecha de registro</Label>
                  <Input
                    id="fechaRegistro"
                    type="date"
                    value={fechaRegistro}
                    onChange={(event) => setFechaRegistro(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Se aplicará al rendimiento de{" "}
                  <strong className="text-foreground capitalize">
                    {formatearPeriodo(periodoAplicado)}
                  </strong>
                </span>
                {prorrateoRecord && (
                  <span className="text-muted-foreground">
                    Valor registrado:{" "}
                    <strong className="text-foreground font-mono">
                      {formatCLP(prorrateoRecord.monto)}
                    </strong>
                  </span>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleGuardarProrrateo}
                  disabled={guardando}
                >
                  {guardando ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {guardando ? "Guardando..." : "Guardar Prorrateo Permiso de circulacion"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
