import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign } from "lucide-react";
import {
  type DatosNomina,
  type DescuentosTAG,
  crearDescuentosTAG,
  validarDatosNomina,
} from "@/lib/nomina";

interface NominaFormProps {
  onCalcular: (data: DatosNomina) => void;
}

const CAMPOS_BASE = [
  { id: "totalFacturado", label: "Total facturado", placeholder: "Ej: 1500000" },
  { id: "gastoOperacional", label: "Gasto operacional", placeholder: "Ej: 100000" },
  { id: "diesel", label: "Diesel", placeholder: "Ej: 200000" },
  { id: "arriendo", label: "Arriendo", placeholder: "Ej: 150000" },
  { id: "seguro", label: "Seguro", placeholder: "Ej: 50000" },
] as const;

const CAMPOS_SECUNDARIOS = [
  { id: "mantencion", label: "Mantención", placeholder: "Ej: 80000" },
  { id: "anticipo", label: "Anticipo", placeholder: "Ej: 100000" },
  { id: "prestamo", label: "Préstamo", placeholder: "Ej: 50000" },
] as const;

const AUTOPISTAS = [
  { key: "autopista1", label: "Autopista 1" },
  { key: "autopista2", label: "Autopista 2" },
  { key: "autopista3", label: "Autopista 3" },
  { key: "autopista4", label: "Autopista 4" },
  { key: "autopista5", label: "Autopista 5" },
  { key: "autopista6", label: "Autopista 6" },
  { key: "autopista7", label: "Autopista 7" },
  { key: "autopista8", label: "Autopista 8" },
] as const;

export default function NominaForm({ onCalcular }: NominaFormProps) {
  const [errores, setErrores] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const parseNum = (key: string): number => {
      const val = form.get(key) as string;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const tag = crearDescuentosTAG();
    for (const { key } of AUTOPISTAS) {
      tag[key] = parseNum(key);
    }

    const data: DatosNomina = {
      trabajadorId: (form.get("trabajadorId") as string) || "",
      nombre: (form.get("nombre") as string) || "",
      totalFacturado: parseNum("totalFacturado"),
      gastoOperacional: parseNum("gastoOperacional"),
      diesel: parseNum("diesel"),
      tag,
      arriendo: parseNum("arriendo"),
      seguro: parseNum("seguro"),
      mantencion: parseNum("mantencion"),
      anticipo: parseNum("anticipo"),
      prestamo: parseNum("prestamo"),
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

  const renderInput = (campo: { id: string; label: string; placeholder: string }) => (
    <div key={campo.id} className="space-y-1">
      <Label htmlFor={campo.id}>{campo.label}</Label>
      <Input
        id={campo.id}
        name={campo.id}
        type="number"
        min="0"
        step="1"
        placeholder={campo.placeholder}
        className={errores[campo.id] ? "border-destructive" : ""}
      />
      {errores[campo.id] && (
        <p className="text-xs text-destructive">{errores[campo.id]}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Datos del trabajador
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="trabajadorId">ID del trabajador</Label>
            <Input
              id="trabajadorId"
              name="trabajadorId"
              placeholder="Ej: cond-001"
              className={errores.trabajadorId ? "border-destructive" : ""}
            />
            {errores.trabajadorId && (
              <p className="text-xs text-destructive">{errores.trabajadorId}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="nombre">Nombre del trabajador</Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Ej: Juan Pérez"
              className={errores.nombre ? "border-destructive" : ""}
            />
            {errores.nombre && (
              <p className="text-xs text-destructive">{errores.nombre}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Ingresos y descuentos primarios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_BASE.map(renderInput)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            TAG - Desglose por autopista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUTOPISTAS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  name={key}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  className={errores[`tag.${key}`] ? "border-destructive" : ""}
                />
                {errores[`tag.${key}`] && (
                  <p className="text-xs text-destructive">{errores[`tag.${key}`]}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Descuentos secundarios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {CAMPOS_SECUNDARIOS.map(renderInput)}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="gap-2">
          <Calculator className="h-5 w-5" />
          Calcular nómina
        </Button>
      </div>
    </form>
  );
}
