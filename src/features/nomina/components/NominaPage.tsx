import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import NominaForm from "./NominaForm";
import NominaResult from "./NominaResult";
import { type DatosNomina, type ResultadoNomina, calcularNomina } from "@/lib/nomina";

export default function NominaPage() {
  const [resultado, setResultado] = useState<ResultadoNomina | null>(null);

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
        title="Cálculo de nómina"
        description="Ingrese los datos del trabajador para calcular el pago final"
      />

      {resultado ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <NominaForm onCalcular={handleCalcular} />
          <div className="space-y-4">
            <NominaResult resultado={resultado} />
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
    </div>
  );
}
