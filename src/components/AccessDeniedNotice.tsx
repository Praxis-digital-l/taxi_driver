import { AlertCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type DeniedState = {
  denied?: {
    attemptedPath?: string;
    message?: string;
  };
};

export default function AccessDeniedNotice() {
  const location = useLocation();
  const deniedState = location.state as DeniedState | null;
  const denied = deniedState?.denied;

  if (!denied?.message) {
    return null;
  }

  return (
    <Alert className="mb-6 border-destructive/30 bg-destructive/5 text-destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Acceso restringido</AlertTitle>
      <AlertDescription>
        {denied.message}
        {denied.attemptedPath ? ` Ruta solicitada: ${denied.attemptedPath}.` : ""}
      </AlertDescription>
    </Alert>
  );
}
