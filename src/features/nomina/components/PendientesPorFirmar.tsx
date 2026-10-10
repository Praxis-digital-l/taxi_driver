import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogPanel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ShieldCheck,
  AlertCircle,
  Copy,
  Upload,
  FileCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchLiquidacionesPendientesFirma,
  deleteLiquidacion,
  actualizarFirmaIniciada,
  obtenerPdfBase64DeLiquidacion,
  subirYEnviarPdfFirmado,
  type LiquidacionRecord,
} from "@/features/nomina/services/liquidacionesService";
import {
  consultarSaldoFirmaWeb,
  enviarAFirmaWeb,
} from "@/features/firmaweb/services/supabaseFirmawebClient";

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
  const [liquidacionAEliminar, setLiquidacionAEliminar] = useState<{ id: string; nombre: string } | null>(null);

  // Estado del modal de FirmaWeb (iniciar o ver enlace existente)
  const [liqActivaFirma, setLiqActivaFirma] = useState<LiquidacionRecord | null>(null);
  const [urlFirmaActiva, setUrlFirmaActiva] = useState<string | null>(null);
  const [procesoIdActivo, setProcesoIdActivo] = useState<number | null>(null);
  const [saldoFES, setSaldoFES] = useState<number | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);
  const [iniciandoFirma, setIniciandoFirma] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Estado para subir y enviar manualmente el PDF firmado al conductor
  const [liqParaSubirPdf, setLiqParaSubirPdf] = useState<LiquidacionRecord | null>(null);
  const [archivoPdfFirmado, setArchivoPdfFirmado] = useState<File | null>(null);
  const [subiendoPdfFirmado, setSubiendoPdfFirmado] = useState(false);
  const fileInputModalRef = useRef<HTMLInputElement>(null);
  const fileInputDirectRef = useRef<HTMLInputElement>(null);

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

  const handleEliminar = (id: string, nombre: string) => {
    setLiquidacionAEliminar({ id, nombre });
  };

  const confirmarEliminacion = async () => {
    if (!liquidacionAEliminar) return;

    const { id, nombre } = liquidacionAEliminar;
    setLiquidacionAEliminar(null);

    try {
      await deleteLiquidacion(id);
      toast.success(`Liquidación de ${nombre} descartada.`);
      cargarPendientes();
    } catch (error: any) {
      toast.error("No se pudo eliminar la liquidación", { description: error.message });
    }
  };

  const handleAbrirFirma = async (liq: LiquidacionRecord) => {
    setLiqActivaFirma(liq);
    setArchivoPdfFirmado(null);
    setProcesoIdActivo(liq.firma_id_proceso ?? null);

    if (liq.firma_url_empleador) {
      setUrlFirmaActiva(liq.firma_url_empleador);
      return;
    }

    setUrlFirmaActiva(null);
    setCargandoSaldo(true);
    try {
      const saldo = await consultarSaldoFirmaWeb();
      setSaldoFES(saldo.fes);
    } catch {
      setSaldoFES(null);
    } finally {
      setCargandoSaldo(false);
    }
  };

  const handleIniciarProcesoFirmaWeb = async () => {
    if (!liqActivaFirma) return;
    setIniciandoFirma(true);
    try {
      const pdfBase64 = await obtenerPdfBase64DeLiquidacion(liqActivaFirma);

      const resultadoNomina = {
        trabajadorId: liqActivaFirma.worker_id,
        nombre: liqActivaFirma.nombre,
        email: liqActivaFirma.email || "",
        rut: liqActivaFirma.rut || "",
        totalFacturado: liqActivaFirma.total_facturado,
        descuentosPrimarios: liqActivaFirma.descuentos_primarios,
        subtotal: liqActivaFirma.total_facturado ?? liqActivaFirma.subtotal,
        descuentosSecundarios: liqActivaFirma.descuentos_secundarios,
        totalDescuentos: liqActivaFirma.total_descuentos,
        totalAPagar: liqActivaFirma.total_a_pagar,
      };

      const res = await enviarAFirmaWeb(
        resultadoNomina,
        pdfBase64,
        liqActivaFirma.mes,
        {
          nombre: "Transportes El Montañez",
          apellidoPaterno: "SpA",
          rut: "77.611.481-2",
          email: "benhantscheruk@gmail.com",
        },
        liqActivaFirma.id
      );

      const urlGenerada = res.firmantes?.[0]?.Url ?? "";
      if (urlGenerada) {
        try {
          const actualizada = await actualizarFirmaIniciada(liqActivaFirma.id, {
            idProceso: res.idProceso,
            idDocumento: res.idDocumento,
            urlEmpleador: urlGenerada,
          });
          setLiqActivaFirma(actualizada);
        } catch (err) {
          console.warn("No se pudo actualizar estado local tras iniciar firma:", err);
        }
      }

      setProcesoIdActivo(res.idProceso);
      setUrlFirmaActiva(urlGenerada);
      toast.success(`¡Proceso #${res.idProceso} creado en FirmaWeb!`, {
        description: "Haz clic en 'Abrir y Firmar en FirmaWeb Ahora' para estampar tu firma.",
      });
      await cargarPendientes();
    } catch (error: any) {
      toast.error("Error al iniciar proceso en FirmaWeb", {
        description: error.message || "No se pudo conectar con FirmaWeb.",
      });
    } finally {
      setIniciandoFirma(false);
    }
  };

  const handleAbrirSubirPdf = (liq: LiquidacionRecord) => {
    setLiqParaSubirPdf(liq);
    setArchivoPdfFirmado(null);
  };

  const handleEnviarPdfFirmadoAlConductor = async (targetLiq: LiquidacionRecord | null) => {
    if (!targetLiq || !archivoPdfFirmado) {
      toast.error("Selecciona el archivo PDF firmado que recibiste en tu correo.");
      return;
    }

    setSubiendoPdfFirmado(true);
    try {
      await subirYEnviarPdfFirmado({
        archivoPdf: archivoPdfFirmado,
        idLiquidacion: targetLiq.id,
        liquidacionExistente: targetLiq,
      });

      toast.success(`Liquidación firmada enviada a ${targetLiq.nombre}`, {
        description: "El documento PDF firmado ya está disponible para el conductor en su portal.",
      });

      setArchivoPdfFirmado(null);
      setLiqParaSubirPdf(null);
      setLiqActivaFirma(null);
      await cargarPendientes();
    } catch (error: any) {
      toast.error("Error al enviar PDF firmado al conductor", {
        description: error.message || "No se pudo subir el archivo PDF.",
      });
    } finally {
      setSubiendoPdfFirmado(false);
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
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Liquidaciones pendientes por firmar y enviar
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {liquidaciones.length === 1
                  ? "1 nómina pendiente de firma o envío del PDF firmado al conductor"
                  : `${liquidaciones.length} nóminas pendientes de firma o envío del PDF firmado al conductor`}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar por conductor, RUT o mes..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-9 pl-8 text-xs border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={cargarPendientes}
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
            <p className="font-semibold text-slate-800 dark:text-slate-100">Flujo de firma y envío manual al conductor</p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
              1) Haz clic en <strong>Firma con FirmaWeb</strong> para firmar la liquidación como empleador. 2) Una vez que recibas en tu correo el PDF firmado por FirmaWeb, súbelo con el botón <strong>Enviar PDF firmado</strong> para que el conductor pueda verlo y descargarlo en su cuenta.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
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
                    : "Todas las liquidaciones emitidas ya han sido firmadas y enviadas a sus respectivos conductores."}
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
                            <Badge className="gap-1 border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 text-[11px]">
                              <Clock className="h-3 w-3" /> Proceso en FirmaWeb
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[11px]">
                              <AlertCircle className="h-3 w-3" /> Sin firmar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                              onClick={() => handleAbrirFirma(liq)}
                            >
                              <PenTool className="h-3.5 w-3.5" />
                              Firma con FirmaWeb
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs border-emerald-600/40 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                              onClick={() => handleAbrirSubirPdf(liq)}
                              title="Subir el PDF firmado recibido por correo y enviarlo al conductor"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Enviar PDF firmado
                            </Button>

                            {liq.file_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Ver borrador PDF"
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

      <AlertDialog open={!!liquidacionAEliminar} onOpenChange={(open) => !open && setLiquidacionAEliminar(null)}>
        <AlertDialogPanel className="sm:max-w-md border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
          <AlertDialogHeader className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <AlertDialogTitle className="text-left text-base text-slate-900 dark:text-slate-100">
              Descartar firma pendiente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-slate-600 dark:text-slate-300">
              Se eliminará la liquidación de <span className="font-semibold text-slate-900 dark:text-slate-100">{liquidacionAEliminar?.nombre}</span> y se perderá su referencia a la firma pendiente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacion}
              className="bg-slate-900 text-white hover:bg-slate-800 text-xs dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Descartar firma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogPanel>
      </AlertDialog>

      {/* Modal para Iniciar o Abrir enlace de FirmaWeb + Subir PDF firmado */}
      <Dialog open={!!liqActivaFirma} onOpenChange={(open) => !open && setLiqActivaFirma(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {!urlFirmaActiva ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <PenTool className="h-5 w-5 text-emerald-600" />
                  Certificación Oficial del Empleador (FirmaWeb)
                </DialogTitle>
                <DialogDescription>
                  Iniciarás el proceso de firma electrónica en FirmaWeb para la liquidación guardada de{" "}
                  <strong>{liqActivaFirma?.nombre}</strong>.
                </DialogDescription>
              </DialogHeader>

              {liqActivaFirma && (
                <div className="space-y-3 py-2 text-sm">
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trabajador:</span>
                      <span className="font-medium">
                        {liqActivaFirma.nombre} ({liqActivaFirma.worker_id})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RUT Trabajador:</span>
                      <span>{liqActivaFirma.rut || "No registrado"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Período:</span>
                      <span className="capitalize">{liqActivaFirma.mes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total a Pagar:</span>
                      <span className="font-bold text-foreground">
                        {MONEDA.format(liqActivaFirma.total_a_pagar)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        {cargandoSaldo
                          ? "Consultando saldo en FirmaWeb..."
                          : saldoFES !== null
                          ? `Saldo disponible: ${saldoFES} firmas simples`
                          : "Conexión lista con FirmaWeb"}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Esta operación consumirá 1 firma FES. El PIN de verificación llegará a{" "}
                        <strong>benhantscheruk@gmail.com</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setLiqActivaFirma(null)}
                  disabled={iniciandoFirma}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleIniciarProcesoFirmaWeb}
                  disabled={iniciandoFirma || cargandoSaldo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                >
                  <PenTool className="h-4 w-4" />
                  {iniciandoFirma ? "Iniciando proceso..." : "Firma con FirmaWeb"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  {procesoIdActivo
                    ? `Proceso #${procesoIdActivo} — ${liqActivaFirma?.nombre}`
                    : `Firma con FirmaWeb: ${liqActivaFirma?.nombre}`}
                </DialogTitle>
                <DialogDescription>
                  1. Abre el portal de FirmaWeb para firmar. 2. Cuando recibas el PDF firmado en tu correo, adjúntalo abajo para enviarlo al conductor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="text-xs text-emerald-900 dark:text-emerald-200">
                    <p className="font-semibold">Paso 1: Firmar en FirmaWeb</p>
                    <p className="text-muted-foreground mt-0.5">
                      El PIN de seguridad y el PDF firmado llegarán a{" "}
                      <strong>benhantscheruk@gmail.com</strong>.
                    </p>
                  </div>

                  <Button
                    size="lg"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md py-5"
                    asChild
                  >
                    <a href={urlFirmaActiva} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir y Firmar en FirmaWeb Ahora
                    </a>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 gap-1.5 text-xs"
                    onClick={() => handleCopiarEnlace(urlFirmaActiva)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiado ? "¡Enlace copiado!" : "Copiar enlace de firma"}
                  </Button>
                </div>

                {/* Paso 2: Subir PDF firmado y enviarlo al conductor */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50 p-4 space-y-3">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Paso 2: Subir y enviar PDF firmado al conductor
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Selecciona el archivo PDF firmado que te envió FirmaWeb por correo para que{" "}
                      <strong>{liqActivaFirma?.nombre}</strong> pueda ver su liquidación firmada.
                    </p>
                  </div>

                  <input
                    ref={fileInputModalRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setArchivoPdfFirmado(f);
                    }}
                  />

                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 text-xs bg-white dark:bg-slate-950"
                      onClick={() => fileInputModalRef.current?.click()}
                    >
                      {archivoPdfFirmado ? (
                        <>
                          <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="truncate font-medium">{archivoPdfFirmado.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-slate-500 shrink-0" />
                          <span>Seleccionar PDF firmado desde mi equipo...</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={!archivoPdfFirmado || subiendoPdfFirmado}
                      onClick={() => handleEnviarPdfFirmadoAlConductor(liqActivaFirma)}
                      className="w-full gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {subiendoPdfFirmado
                        ? "Subiendo y enviando al conductor..."
                        : "Enviar liquidación firmada al conductor"}
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setLiqActivaFirma(null)} className="w-full">
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal directo para subir y enviar el PDF firmado al conductor */}
      <Dialog open={!!liqParaSubirPdf} onOpenChange={(open) => !open && setLiqParaSubirPdf(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-emerald-600" />
              Enviar PDF firmado al conductor
            </DialogTitle>
            <DialogDescription>
              Adjunta el documento PDF firmado que recibiste en{" "}
              <strong>benhantscheruk@gmail.com</strong> para enviarlo al portal de{" "}
              <strong>{liqParaSubirPdf?.nombre}</strong>.
            </DialogDescription>
          </DialogHeader>

          {liqParaSubirPdf && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conductor:</span>
                  <span className="font-semibold">{liqParaSubirPdf.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período:</span>
                  <span className="capitalize">{liqParaSubirPdf.mes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a pagar:</span>
                  <span className="font-bold">{MONEDA.format(liqParaSubirPdf.total_a_pagar)}</span>
                </div>
              </div>

              <input
                ref={fileInputDirectRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setArchivoPdfFirmado(f);
                }}
              />

              <div
                onClick={() => fileInputDirectRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40 p-6 text-center transition-colors"
              >
                {archivoPdfFirmado ? (
                  <div className="space-y-1.5">
                    <FileCheck className="h-8 w-8 text-emerald-600 mx-auto" />
                    <p className="text-xs font-semibold text-foreground break-all">
                      {archivoPdfFirmado.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(archivoPdfFirmado.size / 1024).toFixed(1)} KB · Haz clic para cambiar archivo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="h-8 w-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">
                      Haz clic para seleccionar el PDF firmado
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Solo archivos PDF (.pdf) descargados desde tu correo de FirmaWeb
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setLiqParaSubirPdf(null)}
              disabled={subiendoPdfFirmado}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleEnviarPdfFirmadoAlConductor(liqParaSubirPdf)}
              disabled={!archivoPdfFirmado || subiendoPdfFirmado}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Send className="h-4 w-4" />
              {subiendoPdfFirmado ? "Enviando..." : "Enviar al conductor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


