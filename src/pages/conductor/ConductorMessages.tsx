import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConductorMessages() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mensajes</h1>
        <p className="text-muted-foreground">Comunícate con el administrador</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Mensajes</CardTitle>
          <CardDescription>Mensajes enviados y recibidos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay mensajes</p>
        </CardContent>
      </Card>
    </div>
  );
}
