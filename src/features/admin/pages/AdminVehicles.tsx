import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Plus, Truck, Users, Trash2 } from "lucide-react";
import {
  assignConductorToVehicle,
  createVehicle,
  deleteVehicleById,
  fetchAdminVehiclesData,
  removeVehicleAssignment,
  type ConductorRecord,
  type VehicleAssignmentRecord,
  type VehicleRecord,
} from "@/features/admin/services/adminVehiclesService";

export default function AdminVehicles() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [conductors, setConductors] = useState<ConductorRecord[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignmentRecord[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<VehicleRecord | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminVehiclesData();
      setVehicles(data.vehicles);
      setConductors(data.conductors);
      setAssignments(data.assignments);
    } catch (error) {
      toast({
        title: "Error cargando vehículos",
        description: error instanceof Error ? error.message : "No se pudieron cargar los datos",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const makeSuggestions = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.make?.trim()).filter(Boolean) as string[])].slice(0, 20),
    [vehicles],
  );

  const modelSuggestions = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.model?.trim()).filter(Boolean) as string[])].slice(0, 20),
    [vehicles],
  );

  const colorSuggestions = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.color?.trim()).filter(Boolean) as string[])].slice(0, 20),
    [vehicles],
  );

  const handleCreateVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const yearValue = Number.parseInt(String(form.get("year") || ""), 10);

    try {
      await createVehicle({
        licensePlate: String(form.get("license_plate") || ""),
        make: String(form.get("make") || ""),
        model: String(form.get("model") || ""),
        year: Number.isNaN(yearValue) ? null : yearValue,
        color: String(form.get("color") || ""),
      });
      toast({ title: "Vehículo creado exitosamente" });
      setOpenCreate(false);
      event.currentTarget.reset();
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el vehículo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedVehicle) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const profileId = String(form.get("profile_id") || "");
    if (!profileId) {
      return;
    }

    setLoading(true);
    try {
      await assignConductorToVehicle(selectedVehicle.id, profileId);
      toast({ title: "Conductor asignado exitosamente" });
      setOpenAssign(false);
      event.currentTarget.reset();
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo asignar el conductor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!window.confirm("¿Desasignar este conductor del vehículo?")) {
      return;
    }

    try {
      await removeVehicleAssignment(assignmentId);
      toast({ title: "Asignación eliminada" });
      await load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo quitar la asignación",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) {
      return;
    }

    setLoading(true);
    try {
      await deleteVehicleById(vehicleToDelete.id);
      toast({ title: `Vehículo ${vehicleToDelete.license_plate} eliminado` });
      setVehicleToDelete(null);
      await load();
    } catch (error) {
      toast({
        title: "No se pudo eliminar",
        description: error instanceof Error ? error.message : "El vehículo tiene datos relacionados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAssignments = (vehicleId: string) => assignments.filter((assignment) => assignment.vehicle_id === vehicleId);

  const filteredVehicles = filter === "all" ? vehicles : vehicles.filter((vehicle) => vehicle.status === filter);

  const statusColor = (status: string) => {
    if (status === "active") {
      return "bg-accent/10 text-accent border-accent/20";
    }

    if (status === "maintenance") {
      return "bg-warning/10 text-warning border-warning/20";
    }

    return "bg-muted text-muted-foreground";
  };

  return (
    <div>
      <PageHeader title="Gestión de Vehículos" description={`${vehicles.length} vehículos en flota`}>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="maintenance">Mantención</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Agregar Vehículo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Agregar Vehículo</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="space-y-2">
                <Label>Placa Patente *</Label>
                <Input name="license_plate" required placeholder="ABCD-12" maxLength={10} className="uppercase" />
                <p className="text-[11px] text-muted-foreground">Formato sugerido: AAAA-11</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Marca *</Label>
                  <Input list="vehicle-make-suggestions" name="make" required placeholder="Toyota" />
                  <datalist id="vehicle-make-suggestions">
                    {makeSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Modelo *</Label>
                  <Input list="vehicle-model-suggestions" name="model" required placeholder="Hiace" />
                  <datalist id="vehicle-model-suggestions">
                    {modelSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Input name="year" type="number" min={2000} max={2030} placeholder="2023" />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input list="vehicle-color-suggestions" name="color" placeholder="Blanco" />
                  <datalist id="vehicle-color-suggestions">
                    {colorSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Crear Vehículo"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVehicles.map((vehicle) => {
          const vehicleAssignments = getAssignments(vehicle.id);

          return (
            <Card key={vehicle.id} className="stat-card overflow-hidden">
              <div className="bg-muted/50 border-b px-5 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold tracking-wider truncate">{vehicle.license_plate}</p>
                    <p className="text-xs text-muted-foreground truncate">{vehicle.make} {vehicle.model} {vehicle.year}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusColor(vehicle.status)}`}>
                  {vehicle.status === "active" ? "Activo" : vehicle.status === "maintenance" ? "Mantención" : "Inactivo"}
                </Badge>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Conductores asignados ({vehicleAssignments.length})
                  </p>
                  {vehicleAssignments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin asignaciones</p>
                  ) : (
                    <div className="space-y-1">
                      {vehicleAssignments.map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{assignment.profiles?.full_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleRemoveAssignment(assignment.id)}
                          >
                            Quitar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedVehicle(vehicle);
                      setOpenAssign(true);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Asignar
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-destructive hover:text-destructive"
                    onClick={() => setVehicleToDelete(vehicle)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={openAssign} onOpenChange={setOpenAssign}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Asignar Conductor a {selectedVehicle?.license_plate}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4">
            <div className="space-y-2">
              <Label>Conductor *</Label>
              <Select name="profile_id" required>
                <SelectTrigger><SelectValue placeholder="Seleccionar conductor" /></SelectTrigger>
                <SelectContent>
                  {conductors.map((conductor) => (
                    <SelectItem key={conductor.id} value={conductor.id}>
                      {conductor.full_name} ({conductor.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Asignando..." : "Asignar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(vehicleToDelete)} onOpenChange={(open) => !open && setVehicleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar vehículo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el vehículo {vehicleToDelete?.license_plate}.
              Se intentará conservar datos relacionados cuando existan restricciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVehicle}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
