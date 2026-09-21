import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/context/AuthContext";
import { CheckCircle2, Home, XCircle } from "lucide-react";

export default function PaginaResultadoFirma() {
  const [params] = useSearchParams();

  const estadoStr = params.get("estado");
  const exito = estadoStr !== "cancelado";
  const { profile } = useAuth();

  const volverA = profile?.role === "admin" ? "/admin/nomina" : "/conductor/liquidaciones";

  return exito ? (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <CardTitle className="font-heading mt-4">Documento firmado</CardTitle>
          <CardDescription>
            Tu firma se registró correctamente. El administrador recibirá el PDF firmado y actualizará tu liquidación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link to={volverA}>
              <Home className="mr-2 h-4 w-4" />
              Volver a mis liquidaciones
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
          <CardTitle className="font-heading mt-4">Firma cancelada</CardTitle>
          <CardDescription>
            No se registró ninguna firma. Puedes volver a intentarlo cuando quieras desde tu panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link to={volverA}>
              <Home className="mr-2 h-4 w-4" />
              Volver a mis liquidaciones
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}