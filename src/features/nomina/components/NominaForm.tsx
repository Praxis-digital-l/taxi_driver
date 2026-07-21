import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, UserRound, Mail, Fingerprint } from "lucide-react";
import {
  type DatosNomina,
  type DescuentosTAG,
  crearDescuentosTAG,
  validarDatosNomina,
} from "@/lib/nomina";
import { fetchAdminConductores, type ConductorRecord } from "@/features/admin/services/adminConductoresService";

interface NominaFormProps {
  onCalcular: (data: DatosNomina) => void;
}

const SPINNER_HIDE = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const CAMPOS_BASE = [
  { id: "totalFacturado", label: "Total facturado", placeholder: "Ej: 1.500.000" },
  { id: "gastoOperacional", label: "Gasto operacional", placeholder: "Ej: 100.000" },
  { id: "diesel", label: "Diesel", placeholder: "Ej: 200.000" },
  { id: "arriendo", label: "Arriendo", placeholder: "Ej: 150.000" },
  { id: "seguro", label: "Seguro", placeholder: "Ej: 50.000" },
] as const;

const CAMPOS_SECUNDARIOS = [
  { id: "mantencion", label: "Mantención", placeholder: "Ej: 80.000" },
  { id: "anticipo", label: "Anticipo", placeholder: "Ej: 100.000" },
  { id: "prestamo", label: "Préstamo", placeholder: "Ej: 50.000" },
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

function formatPesos(digits: string): string {
  if (!digits) return "";
  return `$ ${Number(digits).toLocaleString("es-CL")}`;
}

export default function NominaForm({ onCalcular }: NominaFormProps) {
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [conductores, setConductores] = useState<ConductorRecord[]>([]);
  const [selectedConductor, setSelectedConductor] = useState<ConductorRecord | null>(null);

  useEffect(() => {
    fetchAdminConductores()
      .then((data) => setConductores(data.filter((c) => c.worker_id)))
      .catch(() => {});
  }, []);

  const handleCurrencyChange = (id: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, [id]: digits ? formatPesos(digits) : "" }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const parseNum = (key: string): number => {
      const raw = values[key] || "";
      const digits = raw.replace(/\D/g, "");
      return digits ? parseInt(digits, 10) : 0;
    };

    const tag = crearDescuentosTAG();
    for (const { key } of AUTOPISTAS) {
      tag[key] = parseNum(key);
    }

    const data: DatosNomina = {
      trabajadorId: selectedConductor?.worker_id || "",
      nombre: selectedConductor?.full_name || "",
      email: selectedConductor?.email || "",
      rut: selectedConductor?.rut || "",
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
            <Select
              name="trabajadorId"
              value={selectedConductor?.worker_id || ""}
              onValueChange={(value) => {
                const cond = conductores.find((c) => c.worker_id === value);
                setSelectedConductor(cond || null);
              }}
            >
              <SelectTrigger className={errores.trabajadorId ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar conductor..." />
              </SelectTrigger>
              <SelectContent>
                {conductores.map((c) => (
                  <SelectItem key={c.id} value={c.worker_id}>
                    {c.worker_id} — {c.full_name}
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
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 h-[70px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-heading font-medium text-sm truncate">{selectedConductor.full_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {selectedConductor.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Fingerprint className="h-3 w-3" /> {selectedConductor.rut}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-muted/20 h-[70px]">
                <p className="text-xs text-muted-foreground italic">Seleccione un conductor</p>
              </div>
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
          {CAMPOS_BASE.map(renderCurrencyInput)}
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
                  type="text"
                  inputMode="numeric"
                  value={values[key] || ""}
                  onChange={(e) => handleCurrencyChange(key, e.target.value)}
                  placeholder="0"
                  className={`${SPINNER_HIDE} ${errores[`tag.${key}`] ? "border-destructive" : ""}`}
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
          {CAMPOS_SECUNDARIOS.map(renderCurrencyInput)}
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
