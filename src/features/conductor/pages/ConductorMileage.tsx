import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Plus, Gauge, TrendingUp } from "lucide-react";

export default function ConductorMileage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!profile) return;
    const [rRes, vRes] = await Promise.all([
      supabase.from("mileage_records").select("*, vehicles(license_plate)").eq("profile_id", profile.id).order("recorded_date", { ascending: false }).limit(50),
      supabase.from("vehicle_assignments").select("vehicles(id, license_plate)").eq("profile_id", profile.id),
    ]);
    setRecords(rRes.data || []);
    setVehicles((vRes.data || []).map((va: any) => va.vehicles));
  };

  useEffect(() => { load(); }, [profile]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const km = parseInt(form.get("kilometers") as string);
    if (km <= 0) {
      toast({ title: "Error", description: "El kilometraje debe ser mayor a 0.", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("mileage_records").insert({
      profile_id: profile.id,
      vehicle_id: form.get("vehicle_id") as string,
      kilometers: km,
      recorded_date: form.get("recorded_date") as string,
      notes: (form.get("notes") as string) || "",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Kilometraje registrado" });
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  return (
    <div>
      <PageHeader title="Registro de Kilometraje" description={`${records.length} registro(s)`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Registrar Km</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Registrar Kilometraje</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Vehículo *</Label>
                <Select name="vehicle_id" required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kilómetros actuales *</Label>
                <Input name="kilometers" type="number" required min={1} placeholder="Ej: 85420" />
              </div>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input name="recorded_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input name="notes" placeholder="Ej: Lectura en revisión técnica" maxLength={200} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Registrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {records.length === 0 ? (
        <Card><CardContent className="empty-state"><Gauge /><p>No hay registros de kilometraje.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {records.map((rec: any, i: number) => {
            const prev = records[i + 1];
            const diff = prev ? rec.kilometers - prev.kilometers : null;
            return (
              <Card key={rec.id} className="stat-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info shrink-0">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-heading font-bold text-lg">{rec.kilometers.toLocaleString("es-CL")} km</p>
                      {diff !== null && diff > 0 && (
                        <span className="text-xs text-accent flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" />+{diff.toLocaleString("es-CL")} km
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rec.vehicles?.license_plate} • {new Date(rec.recorded_date).toLocaleDateString("es-CL")}
                    </p>
                    {rec.notes && <p className="text-xs text-muted-foreground mt-0.5">{rec.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
