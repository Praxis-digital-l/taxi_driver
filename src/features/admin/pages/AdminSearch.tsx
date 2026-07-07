import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import {
  Search,
  Truck,
  User,
  FileText,
  ClipboardList,
  Gauge,
  StickyNote,
  Plus,
  AlertCircle,
  Download,
} from "lucide-react";
import {
  createAdminNote,
  deleteAdminNote,
  fetchAdminVehicleSearchByPlate,
  fetchVehicleNotes,
  fetchVehiclePlateSuggestions,
  sendMessageToConductor,
  type AdminSearchDocument,
  type AdminSearchMessage,
  type AdminSearchMileage,
  type AdminSearchNote,
  type AdminSearchRequest,
  type AdminSearchVehicle,
  type AssignedConductor,
  type VehicleSearchOption,
} from "@/features/admin/services/adminSearchService";
import { downloadDocumentFile } from "@/shared/utils/storageFiles";

export default function AdminSearch() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState<AdminSearchVehicle | null>(null);
  const [conductor, setConductor] = useState<AssignedConductor | null>(null);
  const [documents, setDocuments] = useState<AdminSearchDocument[]>([]);
  const [requests, setRequests] = useState<AdminSearchRequest[]>([]);
  const [mileage, setMileage] = useState<AdminSearchMileage[]>([]);
  const [notes, setNotes] = useState<AdminSearchNote[]>([]);
  const [messages, setMessages] = useState<AdminSearchMessage[]>([]);
  const [plateSuggestions, setPlateSuggestions] = useState<VehicleSearchOption[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newMessageStatus, setNewMessageStatus] = useState("pendiente");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(false);

  useEffect(() => {
    const loadPlateSuggestions = async () => {
      try {
        const suggestions = await fetchVehiclePlateSuggestions();
        setPlateSuggestions(suggestions);
      } catch (error) {
        toast({
          title: "No se pudieron cargar patentes",
          description: error instanceof Error ? error.message : "Error inesperado",
          variant: "destructive",
        });
      }
    };

    loadPlateSuggestions();
  }, [toast]);

  const normalizeText = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const filteredSuggestions = useMemo(() => {
    const normalizedQuery = normalizeText(plate);

    if (!normalizedQuery) {
      return plateSuggestions.slice(0, 18);
    }

    return plateSuggestions
      .filter((option) => {
        const plateText = normalizeText(option.license_plate);
        const makeText = normalizeText(option.make);
        const modelText = normalizeText(option.model);
        return (
          plateText.includes(normalizedQuery) ||
          makeText.includes(normalizedQuery) ||
          modelText.includes(normalizedQuery)
        );
      })
      .slice(0, 24);
  }, [plateSuggestions, plate]);

  const byStatusCount = useMemo(
    () =>
      plateSuggestions.reduce(
        (accumulator, option) => {
          const key = option.status ?? "inactive";
          accumulator[key] = (accumulator[key] || 0) + 1;
          return accumulator;
        },
        {} as Record<string, number>,
      ),
    [plateSuggestions],
  );

  const clearResultState = () => {
    setVehicle(null);
    setConductor(null);
    setDocuments([]);
    setRequests([]);
    setMileage([]);
    setNotes([]);
    setMessages([]);
    setFound(false);
  };

  const handleSearch = async (plateOverride?: string) => {
    const cleanedPlate = (plateOverride ?? plate).trim().toUpperCase();
    if (!cleanedPlate) {
      return;
    }

    setPlate(cleanedPlate);

    setSearching(true);

    try {
      const result = await fetchAdminVehicleSearchByPlate(cleanedPlate);

      if (!result) {
        clearResultState();
        toast({
          title: "No encontrado",
          description: `No existe un vehículo con patente "${cleanedPlate}".`,
          variant: "destructive",
        });
        return;
      }

      setVehicle(result.vehicle);
      setConductor(result.conductor);
      setDocuments(result.documents);
      setRequests(result.requests);
      setMileage(result.mileage);
      setNotes(result.notes);
      setMessages(result.messages);
      setFound(true);
    } catch (error) {
      clearResultState();
      toast({
        title: "Error al buscar",
        description: error instanceof Error ? error.message : "No se pudo completar la búsqueda",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const getStatusLabel = (status: string | null) => {
    if (status === "active") return "Activo";
    if (status === "maintenance") return "Mantención";
    return "Inactivo";
  };

  const getStatusClassName = (status: string | null) => {
    if (status === "active") return "border-accent/20 bg-accent/10 text-accent";
    if (status === "maintenance") return "border-warning/20 bg-warning/10 text-warning";
    return "border-muted bg-muted text-muted-foreground";
  };

  const addNote = async () => {
    if (!newNote.trim() || !vehicle || !profile) {
      return;
    }

    try {
      await createAdminNote(vehicle.id, profile.id, newNote.trim());
      setNewNote("");
      setNotes(await fetchVehicleNotes(vehicle.id));
      toast({ title: "Nota guardada" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar la nota",
        variant: "destructive",
      });
    }
  };

  const removeNote = async (noteId: string) => {
    try {
      await deleteAdminNote(noteId);
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast({ title: "Nota eliminada" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar la nota",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDocument = async (fileKey: string) => {
    try {
      await downloadDocumentFile(fileKey);
    } catch (error) {
      toast({
        title: "No se pudo descargar",
        description: error instanceof Error ? error.message : "Error descargando archivo",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!profile || !conductor?.id || !newMessage.trim()) {
      return;
    }

    setSendingMessage(true);
    try {
      await sendMessageToConductor({
        senderId: profile.id,
        receiverId: conductor.id,
        content: newMessage,
        status: newMessageStatus,
      });

      setNewMessage("");
      setNewMessageStatus("pendiente");

      if (vehicle?.license_plate) {
        await handleSearch(vehicle.license_plate);
      }

      toast({ title: "Mensaje enviado al conductor" });
    } catch (error) {
      toast({
        title: "Error al enviar mensaje",
        description: error instanceof Error ? error.message : "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) {
      return false;
    }

    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 30 * 86400000;
  };

  return (
    <div>
      <PageHeader title="Buscar por Patente" description="Información consolidada por vehículo" />

      <Card className="mb-6">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-2">
              <Label className="text-xs">Placa Patente</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  list="admin-plate-suggestions"
                  placeholder="Ej: LJTX-42 o marca/modelo"
                  value={plate}
                  onChange={(event) => setPlate(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                  className="font-heading tracking-wider"
                />
                <Button onClick={() => handleSearch()} disabled={searching} className="sm:min-w-[130px]">
                  <Search className="mr-2 h-4 w-4" />
                  {searching ? "Buscando..." : "Buscar"}
                </Button>
              </div>
              <datalist id="admin-plate-suggestions">
                {plateSuggestions.map((option) => (
                  <option key={option.id} value={option.license_plate}>
                    {`${option.make ?? "Sin marca"} ${option.model ?? ""}`.trim()}
                  </option>
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Busca por patente, marca o modelo. Selecciona un resultado para cargar la ficha completa.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium mb-2">Resumen de flota</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>Total: <span className="font-medium text-foreground">{plateSuggestions.length}</span></p>
                <p>Activos: <span className="font-medium text-foreground">{byStatusCount.active || 0}</span></p>
                <p>Mantención: <span className="font-medium text-foreground">{byStatusCount.maintenance || 0}</span></p>
                <p>Inactivos: <span className="font-medium text-foreground">{byStatusCount.inactive || 0}</span></p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <p className="text-xs font-medium">
                Patentes disponibles ({filteredSuggestions.length})
              </p>
              {plate.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setPlate("")}
                >
                  Limpiar filtro
                </Button>
              )}
            </div>

            {filteredSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No hay coincidencias para tu búsqueda.</p>
            ) : (
              <div className="max-h-64 overflow-auto p-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredSuggestions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSearch(option.license_plate)}
                    className="w-full text-left rounded-md border p-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-heading text-sm font-semibold tracking-wider">{option.license_plate}</p>
                      <Badge variant="outline" className={`text-[10px] ${getStatusClassName(option.status)}`}>
                        {getStatusLabel(option.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {`${option.make ?? "Sin marca"} ${option.model ?? ""}`.trim() || "Sin modelo"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {found && vehicle && (
        <Tabs defaultValue="info" className="animate-fade-in">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="info" className="text-xs gap-1"><Truck className="h-3.5 w-3.5" />Vehículo</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Docs ({documents.length})</TabsTrigger>
            <TabsTrigger value="requests" className="text-xs gap-1"><ClipboardList className="h-3.5 w-3.5" />Solicitudes ({requests.length})</TabsTrigger>
            <TabsTrigger value="mileage" className="text-xs gap-1"><Gauge className="h-3.5 w-3.5" />Km ({mileage.length})</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1"><StickyNote className="h-3.5 w-3.5" />Notas ({notes.length})</TabsTrigger>
          </TabsList>

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

            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm">Mensajes por Patente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conductor ? (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Enviar mensaje a <span className="font-medium text-foreground">{conductor.full_name}</span> ({vehicle.license_plate})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
                      <Textarea
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        placeholder="Ej: Programar mantención preventiva para esta semana..."
                        maxLength={1000}
                        rows={2}
                      />
                      <Select value={newMessageStatus} onValueChange={setNewMessageStatus}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="en_proceso">En proceso</SelectItem>
                          <SelectItem value="completado">Completado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !newMessage.trim()}
                        className="h-10"
                      >
                        {sendingMessage ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-lg border p-3">
                    No hay conductor asignado a esta patente. Asigna uno para enviar mensajes.
                  </p>
                )}

                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin mensajes recientes para este vehículo.</p>
                ) : (
                  messages.slice(0, 8).map((message) => (
                    <div key={message.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(message.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      <StatusBadge status={message.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4 space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin documentos asociados.</p>
            ) : (
              documents.map((document) => (
                <Card key={document.id} className="stat-card">
                  <CardContent className="flex items-center gap-4 p-4">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{document.document_types?.name}</p>
                        {isExpiringSoon(document.expiration_date) && (
                          <span className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
                            <AlertCircle className="h-3 w-3" />Por vencer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{document.profiles?.full_name} • {document.description || ""}</p>
                      {document.expiration_date && (
                        <p className="text-xs text-muted-foreground">Vence: {new Date(document.expiration_date).toLocaleDateString("es-CL")}</p>
                      )}
                    </div>
                    <StatusBadge status={document.status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleDownloadDocument(document.file_key)}
                      title="Descargar documento"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin solicitudes asociadas.</p>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="stat-card">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{request.request_types?.name}</p>
                      <p className="text-xs text-muted-foreground">{request.profiles?.full_name} • {request.details || ""}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        {request.amount && <span>$ {Number(request.amount).toLocaleString("es-CL")}</span>}
                        <span>{new Date(request.created_at).toLocaleDateString("es-CL")}</span>
                      </div>
                    </div>
                    <StatusBadge status={request.status} />
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="mileage" className="mt-4 space-y-2">
            {mileage.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin registros de kilometraje.</p>
            ) : (
              mileage.map((record) => (
                <Card key={record.id} className="stat-card">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Gauge className="h-5 w-5 text-info shrink-0" />
                    <div className="flex-1">
                      <p className="font-heading font-bold">{record.kilometers.toLocaleString("es-CL")} km</p>
                      <p className="text-xs text-muted-foreground">{record.profiles?.full_name} • {new Date(record.recorded_date).toLocaleDateString("es-CL")}</p>
                      {record.notes && <p className="text-xs text-muted-foreground">{record.notes}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(event) => setNewNote(event.target.value)}
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
                {notes.map((note) => (
                  <Card key={note.id} className="stat-card">
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{note.note_text}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(note.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeNote(note.id)}
                      >
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
