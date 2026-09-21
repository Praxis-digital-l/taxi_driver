import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PenTool,
  Clock,
  Search,
  RefreshCw,
  Trash2,
  FileDown,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchLiquidacionesPendientesFirma,
  deleteLiquidacion,
  type LiquidacionRecord,
} from "@/features/nomina/services/liquidacionesService";

const MONEDA = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

interface PendientesPorFirmarProps {
  onNuevaNomina?: () => void;
  onTotalPendientesChange?: (count: number) => void;
}

export default function PendientesPorFirmar({
  onNuevaNomina,
  onTotalPendientesChange,
}: PendientesPorFirmarProps) {
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modalEnlace, setModalEnlace] = useState<{ open: boolean; url: string; nombre: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargarPendientes = async () => {
    setCargando(true);
    try {
      const data = await fetchLiquidacionesPendientesFirma();
      setLiquidaciones(data);
      onTotalPendientesChange?.(data.length);
    } catch (error: any) {
      toast.error("Error al cargar pendientes por firmar", {
        description: error.message || "No se pudieron obtener las liquidaciones.",
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPendientes();
  }, []);

  const handleEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de descartar la liquidación pendiente de ${nombre}?`)) return;
    try {
      await deleteLiquidacion(id);
      toast.success(`Liquidación de ${nombre} descartada.`);
      cargarPendientes();
    } catch (error: any) {
      toast.error("No se pudo eliminar la liquidación", { description: error.message });
    }
  };

  const handleAbrirFirma = (liq: LiquidacionRecord) => {
    if (liq.firma_url_empleador) {
      setModalEnlace({
        open: true,
        url: liq.firma_url_empleador,
        nombre: liq.nombre,
      });
    } else {
      toast.info("Para firmar esta liquidación, genérala y presiona 'Firma con FirmaWeb'.");
    }
  };

  const handleCopiarEnlace = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("Enlace copiado al portapapeles");
    setTimeout(() => setCopiado(false), 2000);
  };

  const filtradas = liquidaciones.filter((item) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      item.nombre.toLowerCase().includes(q) ||
      (item.rut && item.rut.toLowerCase().includes(q)) ||
      item.worker_id.toLowerCase().includes(q) ||
      item.mes.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header con métricas y buscador */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Liquidaciones pendientes por firmar
            </h3>
            <p className="text-xs text-muted-foreground">
              {liquidaciones.length === 1
                ? "1 nómina esperando certificación con FirmaWeb"
                : `${liquidaciones.length} nóminas esperando certificación con FirmaWeb`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por conductor, RUT o mes..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={cargarPendientes}
            disabled={cargando}
            className="h-9 px-2.5 shrink-0"
            title="Actualizar lista"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Alerta explicativa */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-semibold">Control de envíos a conductores:</p>
          <p className="text-muted-foreground mt-0.5">
            Por normativa laboral chilena, las liquidaciones solo se enviarán y serán visibles en la app del conductor una vez que hayan sido certificadas con FirmaWeb. Aquí puedes guardarlas y firmarlas en el momento que consideres conveniente.
          </p>
        </div>
      </div>

      {/* Contenedor de la tabla */}
      <Card>
        <CardContent className="p-0">
          {cargando ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              Cargando nóminas pendientes...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  No hay liquidaciones pendientes por firmar
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {busqueda
                    ? "No se encontraron resultados con los filtros actuales."
                    : "Todas las liquidaciones emitidas están certificadas con FirmaWeb o no se han generado borradores aún."}
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
                    <TableHead className="text-right">Total a pagar</TableHead>
                    <TableHead className="text-center">Estado de firma</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((liq) => {
                    const estaEnProceso = liq.firma_estado === "pendiente" || !!liq.firma_url_empleador;
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
                            Emitido: {liq.fecha}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {MONEDA.format(liq.total_a_pagar)}
                        </TableCell>
                        <TableCell className="text-center">
                          {estaEnProceso ? (
                            <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 gap-1 text-[11px]">
                              <Clock className="h-3 w-3" /> Proceso en FirmaWeb
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 bg-amber-500/10 border-amber-500/30 gap-1 text-[11px]">
                              <AlertCircle className="h-3 w-3" /> Sin firmar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {estaEnProceso ? (
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => handleAbrirFirma(liq)}
                              >
                                <PenTool className="h-3.5 w-3.5" />
                                Firma con FirmaWeb
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => handleAbrirFirma(liq)}
                              >
                                <PenTool className="h-3.5 w-3.5" />
                                Firma con FirmaWeb
                              </Button>
                            )}

                            {liq.file_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Ver documento PDF"
                                onClick={() => window.open(liq.file_url!, "_blank")}
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              title="Descartar liquidación"
                              onClick={() => handleEliminar(liq.id, liq.nombre)}
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

      {/* Modal para abrir o copiar enlace de FirmaWeb */}
      <Dialog open={modalEnlace?.open ?? false} onOpenChange={(open) => !open && setModalEnlace(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-emerald-600">
              <PenTool className="h-5 w-5" />
              Firma con FirmaWeb: {modalEnlace?.nombre}
            </DialogTitle>
            <DialogDescription>
              El proceso ya está generado en FirmaWeb. Puedes acceder directamente al portal seguro para estampar la firma del empleador.
            </DialogDescription>
          </DialogHeader>

          {modalEnlace && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <p className="font-semibold">PIN de seguridad:</p>
                  <p className="text-muted-foreground mt-0.5">
                    FirmaWeb enviará el PIN al correo oficial <strong>benhantscheruk@gmail.com</strong> al abrir el enlace.
                  </p>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md py-5"
                  asChild
                >
                  <a href={modalEnlace.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir portal de FirmaWeb
                  </a>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 gap-1.5 text-xs"
                  onClick={() => handleCopiarEnlace(modalEnlace.url)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiado ? "¡Enlace copiado!" : "Copiar enlace de firma"}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEnlace(null)} className="w-full">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

