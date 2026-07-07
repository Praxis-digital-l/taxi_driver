import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConductorVehicles() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Vehículos</h1>
        <p className="text-muted-foreground">Gestiona tus vehículos asignados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehículos Asignados</CardTitle>
          <CardDescription>Lista de vehículos bajo tu responsabilidad</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay vehículos asignados aún</p>
        </CardContent>
      </Card>
    </div>
  );
}
