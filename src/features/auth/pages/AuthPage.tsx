import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { logDevInteraction } from "@/shared/monitoring/devLogger";
import { MOCK_LOCAL_CREDENTIALS } from "@/integrations/supabase/mock";
import { Truck, Shield } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const useMockSupabase = String(import.meta.env.VITE_USE_MOCK_SUPABASE ?? "").toLowerCase() === "true";

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const password = form.get("password") as string;
    logDevInteraction("auth.login.submit", { email });

    if (!email || !password) {
      logDevInteraction("auth.login.validation_error", { reason: "missing_fields" });
      toast({ title: "Campos requeridos", description: "Ingresa correo y contraseña.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logDevInteraction("auth.login.failed", { email, message: error.message });
      toast({ title: "Error al iniciar sesión", description: error.message, variant: "destructive" });
    } else {
      logDevInteraction("auth.login.success", { email });
      navigate("/");
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const email = (form.get("email") as string).trim();
    const password = form.get("password") as string;
    logDevInteraction("auth.register.submit", { email, nameLength: name.length });

    if (!name || !email || password.length < 6) {
      logDevInteraction("auth.register.validation_error", { reason: "invalid_fields" });
      toast({ title: "Datos inválidos", description: "Completa todos los campos. Contraseña mínimo 6 caracteres.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      logDevInteraction("auth.register.failed", { email, message: error.message });
      toast({ title: "Error al registrarse", description: error.message, variant: "destructive" });
    } else {
      logDevInteraction("auth.register.success", { email });
      toast({ title: "¡Cuenta creada!", description: "Ya puedes iniciar sesión." });
      navigate("/");
    }
    setLoading(false);
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
          <CardContent className="pt-6">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Correo electrónico</Label>
                    <Input id="login-email" name="email" type="email" required placeholder="correo@santaaurora.cl" autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input id="login-password" name="password" type="password" required minLength={6} autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Ingresando..." : "Ingresar"}
                  </Button>

                  {useMockSupabase && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                      <p className="font-medium text-foreground">Modo local activo</p>
                      <p className="text-muted-foreground mt-1">Contraseña para todos los usuarios: <span className="font-semibold text-foreground">{MOCK_LOCAL_CREDENTIALS.password}</span></p>
                      <p className="text-muted-foreground mt-1">Admin: <span className="text-foreground">{MOCK_LOCAL_CREDENTIALS.admins[0]}</span></p>
                      <p className="text-muted-foreground mt-1">Conductores disponibles: {MOCK_LOCAL_CREDENTIALS.conductors.length}</p>
                    </div>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Nombre completo</Label>
                    <Input id="reg-name" name="name" required placeholder="Carlos Muñoz Rojas" maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Correo electrónico</Label>
                    <Input id="reg-email" name="email" type="email" required placeholder="correo@santaaurora.cl" autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Contraseña (mín. 6 caracteres)</Label>
                    <Input id="reg-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando cuenta..." : "Crear Cuenta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          Acceso seguro con cifrado de extremo a extremo
        </div>
      </div>
    </div>
  );
}
