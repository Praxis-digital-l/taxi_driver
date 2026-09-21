import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import NominaForm from "./NominaForm";
import NominaResult from "./NominaResult";
import PendientesPorFirmar from "./PendientesPorFirmar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calculator, Clock } from "lucide-react";
import { type DatosNomina, type ResultadoNomina, calcularNomina } from "@/lib/nomina";
import { fetchLiquidacionesPendientesFirma } from "@/features/nomina/services/liquidacionesService";

export default function NominaPage() {
  const [resultado, setResultado] = useState<ResultadoNomina | null>(null);
  const [tabActiva, setTabActiva] = useState<string>("calcular");
  const [totalPendientes, setTotalPendientes] = useState<number>(0);

  const actualizarContadorPendientes = async () => {
    try {
      const data = await fetchLiquidacionesPendientesFirma();
      setTotalPendientes(data.length);
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    actualizarContadorPendientes();
  }, []);

  const handleCalcular = (data: DatosNomina) => {
    const res = calcularNomina(data);
    setResultado(res);
  };

  const handleNuevo = () => {
    setResultado(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Nómina y Liquidaciones"
        description="Calcula pagos, gestiona firmas oficiales en FirmaWeb y controla liquidaciones pendientes"
      />

      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        <TabsList className="grid w-full sm:w-[420px] grid-cols-2">
          <TabsTrigger value="calcular" className="gap-2 text-xs">
            <Calculator className="h-4 w-4" />
            Cálculo de Nómina
          </TabsTrigger>
          <TabsTrigger value="pendientes" className="gap-2 text-xs relative">
            <Clock className="h-4 w-4" />
            Pendientes por firmar
            {totalPendientes > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">
                {totalPendientes}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calcular" className="mt-6">
          {resultado ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <NominaForm onCalcular={handleCalcular} />
              <div className="space-y-4">
                <NominaResult
                  resultado={resultado}
                  onGuardadoPendiente={() => {
                    actualizarContadorPendientes();
                    setTabActiva("pendientes");
                  }}
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
              <NominaForm onCalcular={handleCalcular} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendientes" className="mt-6">
          <PendientesPorFirmar
            onNuevaNomina={() => setTabActiva("calcular")}
            onTotalPendientesChange={(count) => setTotalPendientes(count)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
