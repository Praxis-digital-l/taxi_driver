import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import NominaForm from "./NominaForm";
import NominaResult from "./NominaResult";
import PendientesPorFirmar from "./PendientesPorFirmar";
import Preliquidaciones from "./Preliquidaciones";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calculator, Clock, FileClock } from "lucide-react";
import { toast } from "sonner";
import { type DatosNomina, type ResultadoNomina, calcularNomina } from "@/lib/nomina";
import {
  actualizarPreliquidacion,
  completarPreliquidacion,
  fetchLiquidacionesPendientesFirma,
  fetchPreliquidaciones,
  guardarPreliquidacion,
  type LiquidacionRecord,
} from "@/features/nomina/services/liquidacionesService";

function mensajeError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function obtenerPeriodoActual() {
  const now = new Date();
  return {
    mes: now.toLocaleDateString("es-CL", { month: "long" }),
    fecha: now.toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

export default function NominaPage() {
  const [resultado, setResultado] = useState<ResultadoNomina | null>(null);
  const [calculoVersion, setCalculoVersion] = useState<number>(0);
  const [tabActiva, setTabActiva] = useState<string>("calcular");
  const [totalPendientes, setTotalPendientes] = useState<number>(0);
  const [totalPreliquidaciones, setTotalPreliquidaciones] = useState<number>(0);
  const [preliquidacionActiva, setPreliquidacionActiva] = useState<{
    id: string;
    datos: DatosNomina;
  } | null>(null);
  const [idLiquidacionActiva, setIdLiquidacionActiva] = useState<string | null>(null);
  const [guardandoPreliquidacion, setGuardandoPreliquidacion] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  const actualizarContadorPendientes = async () => {
    try {
      const data = await fetchLiquidacionesPendientesFirma();
      setTotalPendientes(data.length);
    } catch {
      // Silencioso
    }
  };

  const actualizarContadorPreliquidaciones = async () => {
    try {
      const data = await fetchPreliquidaciones();
      setTotalPreliquidaciones(data.length);
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    actualizarContadorPendientes();
    actualizarContadorPreliquidaciones();
  }, [tabActiva]);

  const handleCalcular = async (data: DatosNomina) => {
    const res = calcularNomina(data);

    try {
      if (preliquidacionActiva) {
        const { mes, fecha } = obtenerPeriodoActual();
        const completada = await completarPreliquidacion(
          preliquidacionActiva.id,
          res,
          mes,
          fecha,
        );
        setIdLiquidacionActiva(completada.id);
        setPreliquidacionActiva(null);
        await Promise.all([
          actualizarContadorPreliquidaciones(),
          actualizarContadorPendientes(),
        ]);
        toast.success("Preliquidación completada", {
          description: "Ya puedes firmarla con FirmaWeb o dejarla pendiente de firma.",
        });
      } else {
        setIdLiquidacionActiva(null);
      }

      setResultado(res);
      setCalculoVersion((v) => v + 1);
    } catch (error: unknown) {
      toast.error("No se pudo completar la preliquidación", {
        description: mensajeError(error, "Inténtalo nuevamente."),
      });
    }
  };

  const handleGuardarPreliquidacion = async (datos: DatosNomina) => {
    setGuardandoPreliquidacion(true);
    try {
      const { mes, fecha } = obtenerPeriodoActual();
      if (preliquidacionActiva) {
        await actualizarPreliquidacion(preliquidacionActiva.id, datos, mes, fecha);
        toast.success("Preliquidación actualizada", {
          description: "Los cambios ya están guardados como borrador.",
        });
      } else {
        await guardarPreliquidacion(datos, mes, fecha);
        toast.success("Preliquidación guardada", {
          description: "Puedes retomarla desde la pestaña Preliquidaciones.",
        });
      }
      await actualizarContadorPreliquidaciones();
    } catch (error: unknown) {
      toast.error("No se pudo guardar la preliquidación", {
        description: mensajeError(error, "Inténtalo nuevamente."),
      });
    } finally {
      setGuardandoPreliquidacion(false);
    }
  };

  const handleNuevo = () => {
    setResultado(null);
    setPreliquidacionActiva(null);
    setIdLiquidacionActiva(null);
    setFormVersion((v) => v + 1);
  };

  const handleIrANuevaNomina = () => {
    handleNuevo();
    setTabActiva("calcular");
  };

  const handleContinuarPreliquidacion = (liq: LiquidacionRecord) => {
    if (!liq.datos_nomina) {
      toast.error("Esta preliquidación no tiene datos para reabrir");
      return;
    }

    const datos: DatosNomina = {
      ...liq.datos_nomina,
      trabajadorId: liq.datos_nomina.trabajadorId || liq.worker_id,
      nombre: liq.datos_nomina.nombre || liq.nombre,
      email: liq.datos_nomina.email || liq.email || "",
      rut: liq.datos_nomina.rut || liq.rut || "",
      vehicle_id: liq.datos_nomina.vehicle_id || liq.vehicle_id || "",
      vehicle_plate: liq.datos_nomina.vehicle_plate || liq.vehicle_plate || "",
      vehicle_make: liq.datos_nomina.vehicle_make ?? liq.vehicle_make ?? null,
      vehicle_model: liq.datos_nomina.vehicle_model ?? liq.vehicle_model ?? null,
      vehicle_year: liq.datos_nomina.vehicle_year ?? liq.vehicle_year ?? null,
    };

    setPreliquidacionActiva({ id: liq.id, datos });
    setIdLiquidacionActiva(null);
    setResultado(null);
    setFormVersion((v) => v + 1);
    setTabActiva("calcular");
  };

  const formProps = {
    key: `form-${formVersion}`,
    onCalcular: handleCalcular,
    onGuardarPreliquidacion: handleGuardarPreliquidacion,
    datosIniciales: preliquidacionActiva?.datos ?? null,
    idPreliquidacion: preliquidacionActiva?.id ?? null,
    guardandoPreliquidacion,
    onCancelarEdicion: handleNuevo,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Nómina y Liquidaciones"
        description="Calcula pagos, guarda borradores, gestiona firmas oficiales en FirmaWeb y controla liquidaciones pendientes"
      />

      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        <TabsList className="grid w-full sm:w-[600px] grid-cols-3 border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <TabsTrigger value="calcular" className="gap-2 text-xs data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">
            <Calculator className="h-4 w-4" />
            Cálculo de Nómina
          </TabsTrigger>
          <TabsTrigger value="preliquidaciones" className="gap-2 text-xs relative data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">
            <FileClock className="h-4 w-4" />
            Preliquidaciones
            {totalPreliquidaciones > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                {totalPreliquidaciones}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendientes" className="gap-2 text-xs relative data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">
            <Clock className="h-4 w-4" />
            Pendientes por firmar
            {totalPendientes > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                {totalPendientes}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calcular" className="mt-6">
          {resultado ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <NominaForm {...formProps} />
              <div className="space-y-4">
                <NominaResult
                  key={`${resultado.trabajadorId}-${calculoVersion}`}
                  resultado={resultado}
                  idLiquidacion={idLiquidacionActiva}
                  onGuardadoPendiente={actualizarContadorPendientes}
                  onActualizadoPendientes={actualizarContadorPendientes}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleNuevo}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
                  >
                    Nuevo cálculo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <NominaForm {...formProps} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="preliquidaciones" className="mt-6">
          <Preliquidaciones
            key={tabActiva === "preliquidaciones" ? "active" : "inactive"}
            onContinuar={handleContinuarPreliquidacion}
            onNuevaNomina={handleIrANuevaNomina}
            onTotalPreliquidacionesChange={setTotalPreliquidaciones}
          />
        </TabsContent>

        <TabsContent value="pendientes" className="mt-6">
          <PendientesPorFirmar
            key={tabActiva === "pendientes" ? "active" : "inactive"}
            onNuevaNomina={handleIrANuevaNomina}
            onTotalPendientesChange={setTotalPendientes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
