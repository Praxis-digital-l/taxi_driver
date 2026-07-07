import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConductorDocuments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
        <p className="text-muted-foreground">Gestiona tus documentos y certificaciones</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Documentos</CardTitle>
          <CardDescription>Licencia, permisos, certificados, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay documentos registrados</p>
        </CardContent>
      </Card>
    </div>
  );
}
