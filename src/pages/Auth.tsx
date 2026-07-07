import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();

    console.log("🔑 Intentando login con email:", email);
    console.log("   Contraseña recibida (len):", password.length);

    if (!email || !password) {
      setError("Por favor completa todos los campos");
      toast({
        title: "Campos requeridos",
        description: "Ingresa correo y contraseña.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Login result:", { data, error: authError });

      if (authError) {
        console.error("❌ Error de autenticación:", authError);
        setError(authError.message || "Error al iniciar sesión");
        toast({
          title: "Error al iniciar sesión",
          description: authError.message || "Credenciales inválidas",
          variant: "destructive",
        });
      } else {
        console.log("✅ Login exitoso!");
        toast({
          title: "¡Bienvenido!",
          description: "Iniciando sesión...",
        });
        navigate("/");
      }
    } catch (err) {
      console.error("❌ Error en login:", err);
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">FlotaControl</h1>
          <p className="text-sm text-muted-foreground mt-1">Transportes Santa Aurora SpA</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle>Acceso a la Plataforma</CardTitle>
            <CardDescription>
              Ingresa con tus credenciales para continuar
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@flota.cl"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Admin123!"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>

            {/* Credenciales de demo */}
            <div className="mt-6 pt-6 border-t space-y-2 text-sm">
              <p className="font-medium text-muted-foreground">Credenciales de prueba:</p>
              <div className="bg-slate-50 p-3 rounded space-y-1 text-xs font-mono">
                <p><span className="text-gray-500">Admin:</span> admin@flota.cl / Admin123!</p>
                <p><span className="text-gray-500">Conductor:</span> conductor@flota.cl / Conductor123!</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          🔒 Acceso seguro con cifrado de extremo a extremo
        </p>
      </div>
    </div>
  );
}
