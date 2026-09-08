import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import { Plate } from "@/components/ui/plate";
import VehicleInspectionView from "@/features/vehicles/components/VehicleInspectionView";
import {
  ArrowLeft,
  Truck,
  User,
  FileText,
  ClipboardList,
  Gauge,
  TrendingUp,
  StickyNote,
  ShieldCheck,
  Plus,
  AlertCircle,
  Download,
  CalendarRange,
  Eye,
  CheckCircle2,
  PencilLine,
  Loader2,
} from "lucide-react";
import {
  createAdminNote,
  deleteAdminNote,
  fetchAdminVehicleSearchByPlate,
  fetchVehicleMileageByMonth,
  fetchVehicleNotes,
  type AdminSearchDocument,
  type AdminSearchMileage,
  type AdminSearchNote,
  type AdminSearchRequest,
  type AdminSearchVehicle,
  type AssignedConductor,
} from "@/features/admin/services/adminSearchService";
import { updateVehicleStatus } from "@/features/admin/services/adminVehiclesService";
import {
  INSURANCE_TYPES,
  INSURANCE_TYPE_LABEL,
  markInsurancePaid,
  saveVehicleInsurance,
  getInsuranceDaysLeft,
  isInsuranceExpired,
  isInsuranceExpiring,
  type AdminInsurance,
  type InsurancePaymentStatus,
  type InsuranceType,
} from "@/features/admin/services/adminInsuranceService";
import { downloadDocumentFile } from "@/shared/utils/storageFiles";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import MileageReceiptCard from "@/features/admin/components/MileageReceiptCard";
import MileageMonthReportCard from "@/features/admin/components/MileageMonthReportCard";
import DocumentPreviewDialog from "@/features/admin/components/DocumentPreviewDialog";

export type VehicleDetailViewProps = {
  plate: string;
  onBack?: () => void;
  initialTab?: string;
};

export default function VehicleDetailView({ plate, onBack, initialTab = "info" }: VehicleDetailViewProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<AdminSearchVehicle | null>(null);
  const [conductor, setConductor] = useState<AssignedConductor | null>(null);
  const [documents, setDocuments] = useState<AdminSearchDocument[]>([]);
  const [requests, setRequests] = useState<AdminSearchRequest[]>([]);
  const [mileage, setMileage] = useState<AdminSearchMileage[]>([]);
  const [notes, setNotes] = useState<AdminSearchNote[]>([]);
  const [insurance, setInsurance] = useState<AdminInsurance | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);

  const [insuranceEditing, setInsuranceEditing] = useState(false);
  const [insuranceSaving, setInsuranceSaving] = useState(false);
  const [insurancePaying, setInsurancePaying] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    insuranceType: "comercial" as InsuranceType,
    amount: "",
    expirationDate: "",
    paymentStatus: "pendiente" as InsurancePaymentStatus,
  });

  const [newNote, setNewNote] = useState("");

  const [mileageToDownload, setMileageToDownload] = useState<AdminSearchMileage | null>(null);
  const [mileageDownloading, setMileageDownloading] = useState(false);
  const mileageReceiptRef = useRef<HTMLDivElement>(null);

  const [monthDialogOpen, setMonthDialogOpen] = useState(false);
  const [monthValue, setMonthValue] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthGenerating, setMonthGenerating] = useState(false);
  const [monthRecords, setMonthRecords] = useState<AdminSearchMileage[]>([]);
  const [monthLabel, setMonthLabel] = useState("");
  const monthReportRef = useRef<HTMLDivElement>(null);

  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewDocumentType, setPreviewDocumentType] = useState("");

  const loadVehicleData = useCallback(async () => {
    if (!plate) return;
    setLoading(true);
    try {
      const result = await fetchAdminVehicleSearchByPlate(plate.trim().toUpperCase());
      if (!result) {
        toast({
          title: "Vehículo no encontrado",
          description: `No existe información para la patente "${plate}".`,
          variant: "destructive",
        });
        setVehicle(null);
        return;
      }
      setVehicle(result.vehicle);
      setConductor(result.conductor);
      setDocuments(result.documents);
      setRequests(result.requests);
      setMileage(result.mileage);
      setNotes(result.notes);
      setInsurance(result.insurance);
    } catch (error) {
      toast({
        title: "Error al cargar vehículo",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [plate, toast]);

  useEffect(() => {
    loadVehicleData();
  }, [loadVehicleData]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const addNote = async () => {
    if (!vehicle || !newNote.trim()) return;
    try {
      await createAdminNote(vehicle.id, newNote.trim());
      const updatedNotes = await fetchVehicleNotes(vehicle.id);
      setNotes(updatedNotes);
      setNewNote("");
      toast({ title: "Nota agregada" });
    } catch (error) {
      toast({
        title: "Error al agregar nota",
        description: error instanceof Error ? error.message : "No fue posible guardar la nota",
        variant: "destructive",
      });
    }
  };

  const removeNote = async (id: string) => {
    if (!vehicle) return;
    try {
      await deleteAdminNote(id);
      setNotes((prev) => prev.filter((note) => note.id !== id));
      toast({ title: "Nota eliminada" });
    } catch (error) {
      toast({
        title: "Error al eliminar nota",
        description: error instanceof Error ? error.message : "No fue posible eliminar la nota",
        variant: "destructive",
      });
    }
  };

  const startInsuranceEdit = () => {
    setInsuranceEditing(true);
    setInsuranceForm({
      insuranceType: insurance?.insurance_type ?? "comercial",
      amount: insurance ? String(insurance.amount) : "",
      expirationDate: insurance?.expiration_date ?? "",
      paymentStatus: insurance?.payment_status ?? "pendiente",
    });
  };

  const handleSaveInsurance = async () => {
    if (!vehicle) return;
    const amount = Number(insuranceForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a cero.", variant: "destructive" });
      return;
    }
    if (!insuranceForm.expirationDate) {
      toast({ title: "Fecha requerida", description: "Selecciona una fecha de vencimiento.", variant: "destructive" });
      return;
    }

    setInsuranceSaving(true);
    try {
      await saveVehicleInsurance({
        vehicleId: vehicle.id,
        insuranceType: insuranceForm.insuranceType,
        amount,
        expirationDate: insuranceForm.expirationDate,
        paymentStatus: insuranceForm.paymentStatus,
      });
      setInsuranceEditing(false);
      await loadVehicleData();
      toast({ title: "Seguro guardado" });
    } catch (error) {
      toast({
        title: "Error al guardar seguro",
        description: error instanceof Error ? error.message : "No se pudo guardar el seguro",
        variant: "destructive",
      });
    } finally {
      setInsuranceSaving(false);
    }
  };

  const handlePayInsurance = async () => {
    if (!insurance || !vehicle) return;
    setInsurancePaying(true);
    try {
      await markInsurancePaid(insurance.id);
      await loadVehicleData();
      toast({ title: "Pago del seguro registrado" });
    } catch (error) {
      toast({
        title: "Error al registrar pago",
        description: error instanceof Error ? error.message : "No se pudo registrar el pago",
        variant: "destructive",
      });
    } finally {
      setInsurancePaying(false);
    }
  };

  const handleDownloadMileage = async (record: AdminSearchMileage) => {
    setMileageDownloading(true);
    try {
      flushSync(() => {
        setMileageToDownload(record);
      });
      await new Promise((r) => setTimeout(r, 60));
      const element = mileageReceiptRef.current;
      if (!element) throw new Error("No se pudo preparar el comprobante");

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      const conductorSlug = (record.profiles?.full_name ?? "conductor").replace(/\s+/g, "_").toLowerCase();
      pdf.save(`comprobante_km_${vehicle?.license_plate ?? "vehiculo"}_${conductorSlug}_${record.recorded_date}.pdf`);
      toast({ title: "Comprobante descargado" });
    } catch (error) {
      toast({
        title: "Error al descargar",
        description: error instanceof Error ? error.message : "No se pudo generar el comprobante",
        variant: "destructive",
      });
    } finally {
      setMileageToDownload(null);
      setMileageDownloading(false);
    }
  };

  const openMonthDownload = () => {
    setMonthDialogOpen(true);
  };

  const handleDownloadMonth = async () => {
    if (!vehicle || !monthValue) return;
    const [yearStr, monthStr] = monthValue.split("-");
    const y = Number(yearStr);
    const m = Number(monthStr);

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    const mLabel = `${monthNames[m - 1]} ${y}`;

    setMonthGenerating(true);
    try {
      const records = await fetchVehicleMileageByMonth(vehicle.id, y, m);
      if (records.length === 0) {
        toast({ title: "Sin registros", description: `No hay registros de kilometraje para ${mLabel}.` });
        setMonthGenerating(false);
        return;
      }

      flushSync(() => {
        setMonthRecords(records);
        setMonthLabel(mLabel);
      });

      await new Promise((r) => setTimeout(r, 80));
      const element = monthReportRef.current;
      if (!element) throw new Error("No se pudo preparar la imagen");

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `kilometraje_${vehicle.license_plate}_${monthValue}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({ title: "Imagen descargada", description: `Reporte de ${mLabel} guardado.` });
      setMonthDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error al generar imagen",
        description: error instanceof Error ? error.message : "No fue posible generar la imagen",
        variant: "destructive",
      });
    } finally {
      setMonthRecords([]);
      setMonthGenerating(false);
    }
  };

  const getStatusClassName = (status: string | null) => {
    if (status === "active") return "border-accent/20 bg-accent/10 text-accent";
    if (status === "maintenance") return "border-warning/20 bg-warning/10 text-warning";
    return "border-muted bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Cargando información del vehículo...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">No se encontró el vehículo solicitado.</p>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Vehículos
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 h-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Plate licensePlate={vehicle.license_plate} />
            <div>
              <h2 className="text-lg font-bold font-heading leading-tight text-foreground">
                {vehicle.make} {vehicle.model} {vehicle.year || ""}
              </h2>
              <p className="text-xs text-muted-foreground">
                Color: {vehicle.color || "Sin especificar"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-muted-foreground font-medium">Estado:</span>
          <Select
            value={vehicle.status || "active"}
            onValueChange={async (newStatus: "active" | "inactive" | "maintenance") => {
              try {
                await updateVehicleStatus(vehicle.id, newStatus);
                setVehicle((prev) => (prev ? { ...prev, status: newStatus } : null));
                toast({
                  title: "Estado actualizado",
                  description: `El vehículo ahora está ${
                    newStatus === "active" ? "Activo" : newStatus === "inactive" ? "Inactivo" : "En mantención"
                  }.`,
                });
              } catch (err: any) {
                toast({
                  title: "Error al actualizar estado",
                  description: err.message || "No se pudo actualizar",
                  variant: "destructive",
                });
              }
            }}
          >
            <SelectTrigger className={`h-8 text-xs font-semibold min-w-[130px] ${getStatusClassName(vehicle.status)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
              <SelectItem value="maintenance">Mantención</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="info" className="text-xs gap-1.5"><Truck className="h-3.5 w-3.5" />Vehículo</TabsTrigger>
          <TabsTrigger value="insurance" className="text-xs gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Seguro</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" />Docs ({documents.length})</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Solicitudes ({requests.length})</TabsTrigger>
          <TabsTrigger value="mileage" className="text-xs gap-1.5"><Gauge className="h-3.5 w-3.5" />Km ({mileage.length})</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1.5"><StickyNote className="h-3.5 w-3.5" />Notas ({notes.length})</TabsTrigger>
        </TabsList>

        {/* TAB 1: VEHÍCULO */}
        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" /> Datos del Vehículo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                  <div><p className="text-xs text-muted-foreground">Patente</p><Plate licensePlate={vehicle.license_plate} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <Badge variant="outline" className={`text-xs mt-0.5 capitalize ${getStatusClassName(vehicle.status)}`}>
                      {vehicle.status === "active" ? "Activo" : vehicle.status === "maintenance" ? "Mantención" : "Inactivo"}
                    </Badge>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Marca</p><p>{vehicle.make}</p></div>
                  <div><p className="text-xs text-muted-foreground">Modelo</p><p>{vehicle.model}</p></div>
                  <div><p className="text-xs text-muted-foreground">Año</p><p>{vehicle.year || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Color</p><p>{vehicle.color || "—"}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-accent" /> Conductor Asignado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {conductor ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                    <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Nombre</p><p className="font-medium break-words">{conductor.full_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="break-all">{conductor.email}</p></div>
                    <div><p className="text-xs text-muted-foreground">Teléfono</p><p>{conductor.phone || "—"}</p></div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic py-4">Sin conductor asignado</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Inspección interactiva del vehículo (Cuadro Verde) */}
          <div className="mt-4">
            <VehicleInspectionView
              vehicleId={vehicle.id}
              licensePlate={vehicle.license_plate}
              make={vehicle.make}
              model={vehicle.model}
              year={vehicle.year}
            />
          </div>
        </TabsContent>

        {/* TAB 2: SEGURO */}
        <TabsContent value="insurance" className="space-y-4 mt-4">
          {insuranceEditing ? (
            <Card className="stat-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm">Editar Seguro</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 p-4 sm:p-5">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de seguro</Label>
                  <Select
                    value={insuranceForm.insuranceType}
                    onValueChange={(value) =>
                      setInsuranceForm((prev) => ({ ...prev, insuranceType: value as InsuranceType }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSURANCE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {INSURANCE_TYPE_LABEL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Monto ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={insuranceForm.amount}
                    onChange={(event) =>
                      setInsuranceForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    placeholder="Ej: 150000"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Fecha de vencimiento</Label>
                  <Input
                    type="date"
                    value={insuranceForm.expirationDate}
                    onChange={(event) =>
                      setInsuranceForm((prev) => ({ ...prev, expirationDate: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Estado de pago</Label>
                  <Select
                    value={insuranceForm.paymentStatus}
                    onValueChange={(value) =>
                      setInsuranceForm((prev) => ({ ...prev, paymentStatus: value as InsurancePaymentStatus }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="pagado">Pagado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button onClick={handleSaveInsurance} disabled={insuranceSaving}>
                    {insuranceSaving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button variant="outline" onClick={() => setInsuranceEditing(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          ) : insurance ? (
            <Card className="stat-card">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                    <p className="font-semibold text-sm">{INSURANCE_TYPE_LABEL[insurance.insurance_type]}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isInsuranceExpired(insurance) ? (
                      <Badge variant="outline" className="text-[10px] border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" />Vencido
                      </Badge>
                    ) : isInsuranceExpiring(insurance.expiration_date, 60) ? (
                      <Badge variant="outline" className="text-[10px] border-warning/20 bg-warning/10 text-warning flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" />
                        Por vencer ({getInsuranceDaysLeft(insurance.expiration_date)} día(s))
                      </Badge>
                    ) : null}
                    {insurance.payment_status === "pagado" ? (
                      <Badge variant="outline" className="text-[10px] border-accent/20 bg-accent/10 text-accent">Pagado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-muted bg-muted text-muted-foreground">Pendiente</Badge>
                    )}
                    <Button variant="outline" size="sm" className="h-8" onClick={startInsuranceEdit}>
                      <PencilLine className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                    {insurance.payment_status === "pendiente" && (
                      <Button size="sm" className="h-8" onClick={handlePayInsurance} disabled={insurancePaying}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {insurancePaying ? "Registrando..." : "Marcar como pagado"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-y-3 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Monto</p>
                    <p className="font-heading font-bold">$ {insurance.amount.toLocaleString("es-CL")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vence</p>
                    <p>{new Date(insurance.expiration_date).toLocaleDateString("es-CL")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Último pago</p>
                    <p>{insurance.last_payment_date ? new Date(insurance.last_payment_date).toLocaleDateString("es-CL") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado de pago</p>
                    <p className="capitalize">{insurance.payment_status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="stat-card">
              <CardContent className="p-6 text-center space-y-3">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <div>
                  <p className="text-sm font-medium">Sin seguro registrado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Registra el seguro de este vehículo con su fecha de vencimiento.
                  </p>
                </div>
                <Button size="sm" onClick={startInsuranceEdit}>
                  <Plus className="h-4 w-4 mr-1" /> Registrar Seguro
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: DOCUMENTOS */}
        <TabsContent value="documents" className="space-y-2 mt-4">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin documentos registrados.</p>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id} className="stat-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium">{doc.document_types?.name || "Documento"}</p>
                    <p className="text-xs text-muted-foreground break-all whitespace-pre-wrap">{doc.profiles?.full_name} • {doc.description || ""}</p>
                    {doc.expiration_date && (
                      <p className="text-xs text-muted-foreground">Vence: {new Date(doc.expiration_date).toLocaleDateString("es-CL")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        setPreviewKey(doc.file_key);
                        setPreviewFileName(doc.document_types?.name || "Documento");
                        setPreviewDocumentType(doc.document_types?.name || "");
                      }}
                      title="Vista previa"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        downloadDocumentFile(
                          doc.file_key,
                          `${(doc.document_types?.name || "documento").replace(/\s+/g, "_")}.${doc.file_key.split(".").pop() || "pdf"}`
                        )
                      }
                      title="Descargar documento"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* TAB 4: SOLICITUDES */}
        <TabsContent value="requests" className="space-y-2 mt-4">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin solicitudes para este vehículo.</p>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="stat-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{request.request_types?.name}</p>
                    <p className="text-xs text-muted-foreground break-all whitespace-pre-wrap">{request.profiles?.full_name} • {request.details}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {request.amount && <span>${Number(request.amount).toLocaleString("es-CL")}</span>}
                      <span>{new Date(request.created_at).toLocaleDateString("es-CL")}</span>
                    </div>
                  </div>
                  <StatusBadge status={request.status} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* TAB 5: KILOMETRAJE */}
        <TabsContent value="mileage" className="space-y-2 mt-4">
          <div className="rounded-lg border bg-muted/20 p-3 mb-2 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Registros de kilometraje ({mileage.length})</p>
              <p>Descarga cada registro o todos los de un mes como imagen.</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={openMonthDownload}>
              <CalendarRange className="h-3.5 w-3.5 mr-1" />Descargar mes
            </Button>
          </div>
          {mileage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin registros de kilometraje.</p>
          ) : (
            mileage.map((record, i) => {
              const prev = mileage[i + 1];
              const diff = prev ? record.kilometers - prev.kilometers : null;
              const jornada = (record.notes ?? "").toLowerCase();
              const esInicio = jornada.includes("inicio");
              const esFin = jornada.includes("fin");
              const cardColor = esInicio ? "bg-success/10 border-success" : esFin ? "bg-destructive/10 border-destructive" : "";
              const iconColor = esInicio ? "text-success" : esFin ? "text-destructive" : "text-info";
              return (
                <Card key={record.id} className={`stat-card ${cardColor}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Gauge className={`h-5 w-5 ${iconColor} shrink-0`} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="font-heading font-bold">{record.kilometers.toLocaleString("es-CL")} km</p>
                        {diff !== null && diff > 0 && (
                          <span className="text-xs text-accent flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" />+{diff.toLocaleString("es-CL")} km
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{record.profiles?.full_name} • {new Date(record.recorded_date).toLocaleDateString("es-CL")}</p>
                      {record.notes && <p className="text-xs text-muted-foreground break-all whitespace-pre-wrap">{record.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleDownloadMileage(record)}
                      disabled={mileageDownloading}
                      title={`Descargar kilometraje (${record.kilometers.toLocaleString("es-CL")} km)`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* TAB 6: NOTAS */}
        <TabsContent value="notes" className="space-y-4 mt-4">
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
                      <p className="text-sm break-all whitespace-pre-wrap">{note.note_text}</p>
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

      {/* Document preview modal */}
      <DocumentPreviewDialog
        open={previewKey !== null}
        onOpenChange={(open) => { if (!open) setPreviewKey(null); }}
        fileKey={previewKey ?? ""}
        fileName={previewFileName}
        documentType={previewDocumentType}
      />

      {/* Hidden print renderers */}
      <div className="pointer-events-none fixed -left-[9999px] top-0 z-[-1]">
        {vehicle && mileageToDownload && (
          <div ref={mileageReceiptRef} className="w-[620px] bg-white">
            <MileageReceiptCard vehicle={vehicle} record={mileageToDownload} />
          </div>
        )}
        {vehicle && monthRecords.length > 0 && (
          <div ref={monthReportRef} className="w-[900px] bg-white">
            <MileageMonthReportCard
              vehicle={vehicle}
              records={monthRecords}
              year={Number(monthValue.split("-")[0])}
              month={Number(monthValue.split("-")[1])}
              monthLabel={monthLabel}
            />
          </div>
        )}
      </div>

      {/* Monthly download modal */}
      <Dialog open={monthDialogOpen} onOpenChange={setMonthDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Descargar kilometraje mensual</DialogTitle>
            <DialogDescription>
              Elige el mes y año para descargar una imagen con todos los registros de kilometraje del vehículo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Mes y año</Label>
            <Input
              type="month"
              value={monthValue}
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              onChange={(event) => setMonthValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthDialogOpen(false)} disabled={monthGenerating}>
              Cancelar
            </Button>
            <Button onClick={handleDownloadMonth} disabled={monthGenerating || !monthValue}>
              {monthGenerating ? "Generando..." : "Descargar imagen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

