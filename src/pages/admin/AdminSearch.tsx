import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import RequestPriorityBadge from "@/components/RequestPriorityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { Search, Truck, User, FileText, ClipboardList, Gauge, StickyNote, Plus, AlertCircle, Download } from "lucide-react";
import { sortRequestsByPriority } from "@/lib/requestPriority";

/**
 * AdminSearch — Buscador consolidado por patente.
 * Muestra datos del vehículo, conductor, documentos, solicitudes, kilometraje y notas privadas.
 */
export default function AdminSearch() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState<any>(null);
  const [conductor, setConductor] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [mileage, setMileage] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(false);
  const sortedRequests = useMemo(
    () =>
      sortRequestsByPriority(
        requests,
        (request) => request.request_types?.name,
        (request) => request.created_at,
      ),
    [requests],
  );

  const handleSearch = async () => {
    const cleaned = plate.trim().toUpperCase();
    if (!cleaned) return;
    setSearching(true);
    setFound(false);

    const { data: veh } = await supabase.from("vehicles").select("*").eq("license_plate", cleaned).single();
    if (!veh) {
      toast({ title: "No encontrado", description: `No existe un vehículo con patente "${cleaned}".`, variant: "destructive" });
      setSearching(false);
      return;
    }

    setVehicle(veh);

    const [assignRes, docsRes, reqsRes, milRes, notesRes, msgsRes] = await Promise.all([
      supabase.from("vehicle_assignments").select("profiles(*)").eq("vehicle_id", veh.id),
      supabase.from("documents").select("*, document_types(name), profiles(full_name)").eq("vehicle_id", veh.id).order("created_at", { ascending: false }),
      supabase.from("requests").select("*, request_types(name), profiles(full_name)").eq("vehicle_id", veh.id).order("created_at", { ascending: false }),
      supabase.from("mileage_records").select("*, profiles(full_name)").eq("vehicle_id", veh.id).order("recorded_date", { ascending: false }).limit(20),
      supabase.from("admin_notes").select("*").eq("vehicle_id", veh.id).order("created_at", { ascending: false }),
      // Buscar mensajes enviados a conductores asignados a este vehículo
      supabase.from("vehicle_assignments").select("profile_id").eq("vehicle_id", veh.id),
    ]);

    const conductorProfile = (assignRes.data || [])[0]?.profiles || null;
    setConductor(conductorProfile);

    // Buscar mensajes del conductor asignado
    const profileIds = (msgsRes.data || []).map((a: any) => a.profile_id);
    let msgData: any[] = [];
    if (profileIds.length > 0) {
      const { data } = await supabase.from("messages")
        .select("*, sender:profiles!messages_sender_id_fkey(full_name)")
        .in("receiver_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(10);
      msgData = data || [];
    }

    setDocuments(docsRes.data || []);
    setRequests(reqsRes.data || []);
    setMileage(milRes.data || []);
    setNotes(notesRes.data || []);
    setMessages(msgData);
    setFound(true);
    setSearching(false);
  };

  const addNote = async () => {
    if (!newNote.trim() || !vehicle || !profile) return;
    const { error } = await supabase.from("admin_notes").insert({
      vehicle_id: vehicle.id,
      admin_id: profile.id,
      note_text: newNote.trim(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nota guardada" });
      setNewNote("");
      const { data } = await supabase.from("admin_notes").select("*").eq("vehicle_id", vehicle.id).order("created_at", { ascending: false });
      setNotes(data || []);
    }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("admin_notes").delete().eq("id", id);
    toast({ title: "Nota eliminada" });
    setNotes(notes.filter((n) => n.id !== id));
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 30 * 86400000;
  };

  return (
    <div>
      <PageHeader title="Buscar por Patente" description="Información consolidada por vehículo" />

      <div className="flex items-end gap-3 flex-wrap mb-6">
        <div className="space-y-1.5 flex-1 min-w-[200px] max-w-sm">
          <Label className="text-xs">Placa Patente</Label>
          <Input
            placeholder="Ej: LJTX-42"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="font-heading tracking-wider"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching}>
          <Search className="mr-2 h-4 w-4" />
          {searching ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {found && vehicle && (
        <Tabs defaultValue="info" className="animate-fade-in">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="info" className="text-xs gap-1"><Truck className="h-3.5 w-3.5" />Vehículo</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Docs ({documents.length})</TabsTrigger>
            <TabsTrigger value="requests" className="text-xs gap-1"><ClipboardList className="h-3.5 w-3.5" />Solicitudes ({requests.length})</TabsTrigger>
            <TabsTrigger value="mileage" className="text-xs gap-1"><Gauge className="h-3.5 w-3.5" />Km ({mileage.length})</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1"><StickyNote className="h-3.5 w-3.5" />Notas ({notes.length})</TabsTrigger>
          </TabsList>

          {/* TAB: Info del vehículo y conductor */}
          <TabsContent value="info" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-sm flex items-center gap-2"><Truck className="h-4 w-4 text-primary" />Datos del Vehículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-y-2">
                    <div><p className="text-xs text-muted-foreground">Patente</p><p className="font-heading font-bold">{vehicle.license_plate}</p></div>
                    <div><p className="text-xs text-muted-foreground">Estado</p><p className="capitalize">{vehicle.status}</p></div>
                    <div><p className="text-xs text-muted-foreground">Marca</p><p>{vehicle.make}</p></div>
                    <div><p className="text-xs text-muted-foreground">Modelo</p><p>{vehicle.model}</p></div>
                    <div><p className="text-xs text-muted-foreground">Año</p><p>{vehicle.year || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Color</p><p>{vehicle.color || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-sm flex items-center gap-2"><User className="h-4 w-4 text-accent" />Conductor Asignado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {conductor ? (
                    <div className="grid grid-cols-2 gap-y-2">
                      <div className="col-span-2"><p className="text-xs text-muted-foreground">Nombre</p><p className="font-medium">{conductor.full_name}</p></div>
                      <div><p className="text-xs text-muted-foreground">Email</p><p>{conductor.email}</p></div>
                      <div><p className="text-xs text-muted-foreground">Teléfono</p><p>{conductor.phone || "—"}</p></div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic py-4">Sin conductor asignado</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Mensajes enviados al conductor */}
            {messages.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-sm">Mensajes Recientes al Conductor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {messages.slice(0, 5).map((msg: any) => (
                    <div key={msg.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(msg.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</p>
                      </div>
                      <StatusBadge status={msg.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB: Documentos */}
          <TabsContent value="documents" className="mt-4 space-y-2">
            {documents.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sin documentos asociados.</p> : documents.map((doc: any) => (
              <Card key={doc.id} className="stat-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{doc.document_types?.name}</p>
                      {isExpiringSoon(doc.expiration_date) && (
                        <span className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" />Por vencer
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{doc.profiles?.full_name} • {doc.description || ""}</p>
                    {doc.expiration_date && <p className="text-xs text-muted-foreground">Vence: {new Date(doc.expiration_date).toLocaleDateString("es-CL")}</p>}
                  </div>
                  <StatusBadge status={doc.status} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <a href={doc.file_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* TAB: Solicitudes */}
          <TabsContent value="requests" className="mt-4 space-y-2">
            {sortedRequests.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sin solicitudes asociadas.</p> : sortedRequests.map((req: any) => (
              <Card key={req.id} className="stat-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{req.request_types?.name}</p>
                      <RequestPriorityBadge requestTypeName={req.request_types?.name} />
                    </div>
                    <p className="text-xs text-muted-foreground">{req.profiles?.full_name} • {req.details || ""}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      {req.amount && <span>💰 ${Number(req.amount).toLocaleString("es-CL")}</span>}
                      <span>{new Date(req.created_at).toLocaleDateString("es-CL")}</span>
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* TAB: Kilometraje */}
          <TabsContent value="mileage" className="mt-4 space-y-2">
            {mileage.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sin registros de kilometraje.</p> : mileage.map((m: any) => (
              <Card key={m.id} className="stat-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <Gauge className="h-5 w-5 text-info shrink-0" />
                  <div className="flex-1">
                    <p className="font-heading font-bold">{m.kilometers.toLocaleString("es-CL")} km</p>
                    <p className="text-xs text-muted-foreground">{m.profiles?.full_name} • {new Date(m.recorded_date).toLocaleDateString("es-CL")}</p>
                    {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* TAB: Notas privadas */}
          <TabsContent value="notes" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Escribir nota privada sobre este vehículo..."
                className="flex-1"
                maxLength={500}
                rows={2}
              />
              <Button onClick={addNote} disabled={!newNote.trim()} size="icon" className="shrink-0 self-end h-10 w-10">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin notas privadas.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n: any) => (
                  <Card key={n.id} className="stat-card">
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{n.note_text}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">{new Date(n.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive shrink-0" onClick={() => deleteNote(n.id)}>
                        Eliminar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}


