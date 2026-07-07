import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConductorRequests() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Solicitudes</h1>
        <p className="text-muted-foreground">Gestiona tus solicitudes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Solicitudes</CardTitle>
          <CardDescription>Solicitudes pendientes, en proceso y completadas</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay solicitudes registradas</p>
        </CardContent>
      </Card>
    </div>
  );
}
