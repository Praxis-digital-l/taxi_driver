import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConductorMileage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kilometraje</h1>
        <p className="text-muted-foreground">Registra y controla el kilometraje de tus viajes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Kilometraje</CardTitle>
          <CardDescription>Historial de kilómetros recorridos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay registros de kilometraje</p>
        </CardContent>
      </Card>
    </div>
  );
}
