import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge, { REQUEST_STATUSES } from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { Plus, ClipboardList } from "lucide-react";

export default function ConductorRequests() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [reqTypes, setReqTypes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = async () => {
    if (!profile) return;
    const [rRes, tRes, vRes] = await Promise.all([
      supabase.from("requests").select("*, request_types(name), vehicles(license_plate)").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("request_types").select("*").order("name"),
      supabase.from("vehicle_assignments").select("vehicles(id, license_plate)").eq("profile_id", profile.id),
    ]);
    setRequests(rRes.data || []);
    setReqTypes(tRes.data || []);
    setVehicles((vRes.data || []).map((va: any) => va.vehicles));
  };

  useEffect(() => { load(); }, [profile]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const vehicleId = form.get("vehicle_id") as string;
    const amount = parseFloat(form.get("amount") as string);

    const { error } = await supabase.from("requests").insert({
      profile_id: profile.id,
      request_type_id: form.get("request_type_id") as string,
      vehicle_id: vehicleId === "none" ? null : vehicleId,
      details: (form.get("details") as string).trim(),
      amount: isNaN(amount) ? null : amount,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitud creada exitosamente" });
      setOpen(false);
      load();
    }
    setLoading(false);
  };

  const filtered = filterStatus === "all" ? requests : requests.filter((r: any) => r.status === filterStatus);

  return (
    <div>
      <PageHeader title="Mis Solicitudes" description={`${requests.length} solicitud(es) en total`}>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {REQUEST_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Nueva Solicitud</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Crear Solicitud</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de solicitud *</Label>
                <Select name="request_type_id" required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {reqTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehículo asociado</Label>
                <Select name="vehicle_id" defaultValue="none">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vehículo</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto estimado (CLP)</Label>
                <Input name="amount" type="number" step="1" min="0" placeholder="Ej: 150000" />
              </div>
              <div className="space-y-2">
                <Label>Detalles *</Label>
                <Textarea name="details" required placeholder="Describe tu solicitud con el mayor detalle posible..." maxLength={500} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Enviar Solicitud"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {filtered.length === 0 ? (
        <Card><CardContent className="empty-state"><ClipboardList /><p>No hay solicitudes con estos filtros.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((req: any) => (
            <Card key={req.id} className="stat-card">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{req.request_types?.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{req.details || "Sin detalles"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    {req.vehicles?.license_plate && <span>🚗 {req.vehicles.license_plate}</span>}
                    {req.amount && <span>💰 ${Number(req.amount).toLocaleString("es-CL")}</span>}
                    <span>{new Date(req.created_at).toLocaleDateString("es-CL")}</span>
                  </div>
                </div>
                <StatusBadge status={req.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
