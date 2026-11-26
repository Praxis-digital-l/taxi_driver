import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Play,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteLiquidacion,
  fetchPreliquidaciones,
  type LiquidacionRecord,
} from "@/features/nomina/services/liquidacionesService";

function mensajeError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface PreliquidacionesProps {
  onContinuar: (liq: LiquidacionRecord) => void;
  onNuevaNomina?: () => void;
  onTotalPreliquidacionesChange?: (count: number) => void;
}

export default function Preliquidaciones({
  onContinuar,
  onNuevaNomina,
  onTotalPreliquidacionesChange,
}: PreliquidacionesProps) {
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [liqAEliminar, setLiqAEliminar] = useState<{ id: string; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await fetchPreliquidaciones();
      setLiquidaciones(data);
      onTotalPreliquidacionesChange?.(data.length);
    } catch (error: unknown) {
      toast.error("Error al cargar preliquidaciones", {
        description: mensajeError(error, "No se pudieron obtener los borradores."),
      });
    } finally {
      setCargando(false);
    }
  }, [onTotalPreliquidacionesChange]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmarEliminacion = async () => {
    if (!liqAEliminar) return;
    const { id, nombre } = liqAEliminar;
    setLiqAEliminar(null);

    try {
      await deleteLiquidacion(id);
      toast.success(`Preliquidación de ${nombre} eliminada.`);
      await cargar();
    } catch (error: unknown) {
      toast.error("No se pudo eliminar la preliquidación", {
        description: mensajeError(error, "Inténtalo nuevamente."),
      });
    }
  };

  const filtradas = liquidaciones.filter((item) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      item.nombre.toLowerCase().includes(q) ||
      (item.rut && item.rut.toLowerCase().includes(q)) ||
      item.worker_id.toLowerCase().includes(q) ||
      item.mes.toLowerCase().includes(q) ||
      (item.vehicle_plate && item.vehicle_plate.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Bookmark className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Preliquidaciones guardadas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {liquidaciones.length === 1
                  ? "1 borrador listo para retomar"
                  : `${liquidaciones.length} borradores listos para retomar`}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar por conductor, RUT, mes o patente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-9 pl-8 text-xs border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={cargar}
              disabled={cargando}
              className="h-9 shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              title="Actualizar lista"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Cómo funcionan las preliquidaciones</p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
              Se guardan con los datos ingresados hasta ese momento. Al continuarlas se abre el cálculo con esos datos;
              al completarlas puedes firmarlas con FirmaWeb o dejarlas pendientes de firma. No se envían al conductor ni
              cuentan en finanzas hasta completarse.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardContent className="p-0">
          {cargando ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              Cargando preliquidaciones...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  No hay preliquidaciones guardadas
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {busqueda
                    ? "No se encontraron resultados con los filtros actuales."
                    : "Guarda una preliquidación desde el cálculo de nómina para retomarla después."}
                </p>
              </div>
              {onNuevaNomina && (
                <Button size="sm" onClick={onNuevaNomina} className="mt-2 text-xs">
                  Calcular nueva nómina
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Conductor</TableHead>
                    <TableHead>RUT / ID</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((liq) => {
                    const reanudable = !!liq.datos_nomina;
                    return (
                      <TableRow key={liq.id} className="text-xs">
                        <TableCell className="font-semibold text-foreground">
                          {liq.nombre}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {liq.email || "Sin correo"}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono">
                          {liq.rut || "No registrado"}
                          <span className="block text-[10px] text-muted-foreground">
                            ID: {liq.worker_id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize font-medium">{liq.mes}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            Guardada: {liq.fecha}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{liq.vehicle_plate || "—"}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {[liq.vehicle_make, liq.vehicle_model].filter(Boolean).join(" ") || "Sin vehículo"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {reanudable ? (
                            <Badge className="gap-1 border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]">
                              <Bookmark className="h-3 w-3" /> Borrador
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-[11px]">
                              <AlertCircle className="h-3 w-3" /> Sin datos reanudables
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              disabled={!reanudable}
                              title={reanudable ? "Continuar editando esta preliquidación" : "Esta preliquidación no tiene datos guardados para reabrir"}
                              className="h-8 gap-1.5 text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                              onClick={() => onContinuar(liq)}
                            >
                              <Play className="h-3.5 w-3.5" />
                              Continuar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              title="Eliminar preliquidación"
                              onClick={() => setLiqAEliminar({ id: liq.id, nombre: liq.nombre })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!liqAEliminar} onOpenChange={(open) => !open && setLiqAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar preliquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el borrador de <strong>{liqAEliminar?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminacion}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
