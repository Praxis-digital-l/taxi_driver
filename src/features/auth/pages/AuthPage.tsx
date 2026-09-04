import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { logDevInteraction } from "@/shared/monitoring/devLogger";
import { BrandMark } from "@/components/ui/BrandMark";
import ThemeSwitch from "@/components/ThemeSwitch";
import { Shield } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Foco del turno: la luz ámbar del techo que se ve desde lejos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[110px]"
      />

      <div className="absolute right-4 top-4">
        <ThemeSwitch />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Marca: el taxi del turno */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-[18px] bg-board shadow-[0_0_45px_rgba(248,161,30,0.45)]"
            aria-hidden="true"
          >
            <BrandMark className="h-8 w-8 animate-beacon" />
          </div>

          <p className="font-data text-[10px] uppercase tracking-[0.34em] text-primary">Transportes El Montañez</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-wide text-foreground">Control de flota</h1>
          <p className="mt-2 text-sm text-muted-foreground">Inicia tu turno para ver tu flota hoy.</p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-[0_18px_45px_-20px_rgba(20,26,41,0.4)]">
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Correo electrónico</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  placeholder="correo@santaaurora.cl"
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? "Ingresando..." : "Iniciar turno"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          Acceso seguro con cifrado de extremo a extremo
        </div>
      </div>
    </div>
  );
}