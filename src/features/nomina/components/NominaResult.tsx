import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Fingerprint,
  FileDown,
  Send,
  PenTool,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Clock,
  Upload,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type ResultadoNomina } from "@/lib/nomina";
import {
  guardarLiquidacionPendiente,
  actualizarFirmaIniciada,
  subirYEnviarPdfFirmado,
  blobToBase64,
} from "@/features/nomina/services/liquidacionesService";
import {
  consultarSaldoFirmaWeb,
  enviarAFirmaWeb,
  type FirmanteUrlInfo,
} from "@/features/firmaweb/services/supabaseFirmawebClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { LOGO_APP_BASE64 } from "./logoBase64";

const MONEDA = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,S
});

interface NominaResultProps {
  resultado: ResultadoNomina;
  onGuardadoPendiente?: () => void;
  onActualizadoPendientes?: () => void;
}

function Fila({ concepto, monto, esTotal = false }: { concepto: string; monto: number; esTotal?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${esTotal ? "font-bold text-base" : "text-sm"}`}>
      <span>{concepto}</span>
      <span className={monto < 0 ? "text-destructive" : ""}>{MONEDA.format(monto)}</span>
    </div>
  );
}

export default function NominaResult({
  resultado,
  onGuardadoPendiente,
  onActualizadoPendientes,
}: NominaResultProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputModalRef = useRef<HTMLInputElement>(null);
  const fileInputDirectRef = useRef<HTMLInputElement>(null);

  const [descargando, setDescargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [guardandoPendiente, setGuardandoPendiente] = useState(false);
  const [estaFirmada, setEstaFirmada] = useState(false);
  const [enviadaAlConductor, setEnviadaAlConductor] = useState(false);
  const [liquidacionGuardadaId, setLiquidacionGuardadaId] = useState<string | null>(null);

  // Estado para subir manualmente el PDF firmado que llega al correo
  const [modalSubirPdfOpen, setModalSubirPdfOpen] = useState(false);
  const [archivoPdfFirmado, setArchivoPdfFirmado] = useState<File | null>(null);

  const { toast } = useToast();
  const now = new Date();
  const mes = now.toLocaleDateString("es-CL", { month: "long" });
  const fecha = now.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const generarPDF = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    // Direct full-bleed 210mm x 297mm mapping (cero márgenes blancos arriba/lados)
    pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");
    return pdf.output("blob");
  };

  const handleDescargarPDF = async () => {
    setDescargando(true);
    try {
      const blob = await generarPDF();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `liquidacion-${resultado.trabajadorId}-${now.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silencioso
    } finally {
      setDescargando(false);
    }
  };

  const handleEnviarCorreo = () => {
    const asunto = encodeURIComponent(`Liquidación ${resultado.nombre} - ${mes}`);
    const destinatario = encodeURIComponent(resultado.email);
    const cuerpo = encodeURIComponent(
      `Estimado/a,\n\nAdjunto la liquidación de ${resultado.nombre} (${resultado.trabajadorId}) correspondiente al mes de ${mes}.\n\nSaludos,\nTransportes El Montañez`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${destinatario}&su=${asunto}&body=${cuerpo}`,
      "_blank"
    );
  };

  const handleGuardarPendiente = async () => {
    if (liquidacionGuardadaId) {
      toast({
        title: "Liquidación ya en Pendientes por Firmar",
        description: `La liquidación de ${resultado.nombre} ya se encuentra guardada en la pestaña de pendientes.`,
      });
      onGuardadoPendiente?.();
      return;
    }

    setGuardandoPendiente(true);
    try {
      const blob = await generarPDF();
      const liq = await guardarLiquidacionPendiente(resultado, mes, fecha, blob);
      setLiquidacionGuardadaId(liq.id);
      toast({
        title: "Guardado en Pendientes por Firmar",
        description: `La liquidación de ${resultado.nombre} quedó registrada. Podrás certificarla con FirmaWeb en la pestaña de pendientes.`,
      });
      onGuardadoPendiente?.();
    } catch (error) {
      toast({
        title: "Error al guardar en pendientes",
        description: error instanceof Error ? error.message : "No se pudo guardar la liquidación.",
        variant: "destructive",
      });
    } finally {
      setGuardandoPendiente(false);
    }
  };

  const handleSubirYEnviarPdfFirmado = async () => {
    if (!archivoPdfFirmado) {
      toast({
        title: "Archivo requerido",
        description: "Selecciona el archivo PDF firmado que recibiste en tu correo de FirmaWeb.",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);
    try {
      const liq = await subirYEnviarPdfFirmado({
        archivoPdf: archivoPdfFirmado,
        idLiquidacion: liquidacionGuardadaId,
        resultado,
        mes,
        fecha,
      });

      setLiquidacionGuardadaId(liq.id);
      setEnviadaAlConductor(true);
      setEstaFirmada(true);
      setArchivoPdfFirmado(null);
      setModalSubirPdfOpen(false);
      setModalFirmaOpen(false);
      onActualizadoPendientes?.();

      toast({
        title: "Liquidación firmada enviada al conductor",
        description: `El PDF firmado ya está disponible en la cuenta de ${resultado.nombre} (${resultado.trabajadorId}).`,
      });
    } catch (error) {
      toast({
        title: "Error al enviar PDF firmado",
        description: error instanceof Error ? error.message : "No se pudo subir y enviar la liquidación.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  const [enviandoFirma, setEnviandoFirma] = useState(false);
  const [modalFirmaOpen, setModalFirmaOpen] = useState(false);
  const [saldoFES, setSaldoFES] = useState<number | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);
  const [firmantesResultado, setFirmantesResultado] = useState<FirmanteUrlInfo[] | null>(null);
  const [procesoIdExitoso, setProcesoIdExitoso] = useState<number | null>(null);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);

  const handleAbrirModalFirma = async () => {
    setModalFirmaOpen(true);
    setArchivoPdfFirmado(null);
    if (firmantesResultado && firmantesResultado.length > 0) {
      return;
    }
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

  const handleConfirmarFirmaWeb = async () => {
    setEnviandoFirma(true);
    try {
      const blob = await generarPDF();
      if (!blob) throw new Error("No se pudo compilar el PDF de la liquidación.");

      const pdfBase64 = await blobToBase64(blob);

      let liqId = liquidacionGuardadaId;
      if (!liqId) {
        try {
          const liq = await guardarLiquidacionPendiente(resultado, mes, fecha, blob);
          liqId = liq.id;
          setLiquidacionGuardadaId(liqId);
        } catch (e) {
          console.warn("No se pudo pre-guardar liquidación en BD:", e);
        }
      }

      const res = await enviarAFirmaWeb(
        resultado,
        pdfBase64,
        mes,
        {
          nombre: "Transportes El Montañez",
          apellidoPaterno: "SpA",
          rut: "77.611.481-2",
          email: "benhantscheruk@gmail.com",
        },
        liqId || undefined
      );

      const urlEmpleador = res.firmantes?.[0]?.Url ?? "";
      if (liqId && urlEmpleador) {
        try {
          await actualizarFirmaIniciada(liqId, {
            idProceso: res.idProceso,
            idDocumento: res.idDocumento,
            urlEmpleador,
          });
        } catch (err) {
          console.warn("No se pudo actualizar estado local tras iniciar firma:", err);
        }
      }

      setProcesoIdExitoso(res.idProceso);
      setFirmantesResultado(res.firmantes);
      setEstaFirmada(true);
      onActualizadoPendientes?.();

      toast({
        title: "¡Proceso creado en FirmaWeb!",
        description: `Proceso #${res.idProceso} iniciado exitosamente. Firma el documento y luego sube el PDF firmado recibido en tu correo.`,
      });
    } catch (error) {
      toast({
        title: "Error al enviar a FirmaWeb",
        description: error instanceof Error ? error.message : "No se pudo iniciar el proceso de firma.",
        variant: "destructive",
      });
    } finally {
      setEnviandoFirma(false);
    }
  };

  const handleCopiarUrl = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopiadoIdx(idx);
    setTimeout(() => setCopiadoIdx(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnviarCorreo}
          disabled={descargando}
          className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <Send className="h-4 w-4" />
          {descargando ? "Generando..." : "Enviar por correo"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <FileDown className="h-4 w-4" />
          {descargando ? "Generando..." : "Descargar PDF"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleGuardarPendiente}
          disabled={descargando || guardandoPendiente || enviadaAlConductor}
          className="gap-2 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Clock className="h-4 w-4" />
          {guardandoPendiente ? "Guardando..." : "Guardar en pendientes por firmar"}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setArchivoPdfFirmado(null);
            setModalSubirPdfOpen(true);
          }}
          disabled={enviando || enviadaAlConductor}
          className={`gap-2 ${
            enviadaAlConductor
              ? "bg-emerald-600 text-white opacity-90"
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          }`}
          title="Subir el PDF firmado recibido en tu correo y enviarlo al conductor"
        >
          {enviadaAlConductor ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              PDF firmado enviado
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {enviando ? "Enviando..." : "Enviar PDF firmado al conductor"}
            </>
          )}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleAbrirModalFirma}
          disabled={descargando || enviando || enviandoFirma || guardandoPendiente || enviadaAlConductor}
          className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <PenTool className="h-4 w-4" />
          Firma con FirmaWeb
        </Button>
      </div>

      {/* DOCUMENTO LIQUIDACIÓN DE NÓMINA (A4 ESTRUCTURA EXACTA) */}
      <div
        ref={cardRef}
        style={{ width: "800px", minHeight: "1131px" }}
        className="mx-auto bg-white text-slate-900 font-sans flex flex-col justify-between border border-slate-200 rounded-none p-0 overflow-hidden shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
      >
        <div className="w-full m-0 p-0">
          <div className="w-full bg-slate-100 text-slate-900 px-10 py-7 rounded-none m-0 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={LOGO_APP_BASE64}
                  alt="Transportes El Montañez"
                  className="h-12 w-12 rounded-xl object-contain shrink-0 border border-slate-200 bg-white p-1 shadow-sm"
                />
                <div>
                  <h2 className="text-2xl font-black tracking-wider uppercase text-slate-900 leading-none font-heading">
                    TRANSPORTES EL MONTAÑEZ
                  </h2>
                  <p className="text-[11px] font-bold tracking-[0.22em] text-slate-600 uppercase mt-1 font-heading">
                    LIQUIDACIÓN DE NÓMINA
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold tracking-[0.22em] text-slate-600 uppercase block font-heading">
                  DOCUMENTO OFICIAL
                </span>
                <span className="text-3xl font-black capitalize text-slate-900 tracking-tight block leading-tight font-heading">
                  {mes}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Emitido el {fecha}
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10 space-y-5 bg-white">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 items-start">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-heading">
                    TRABAJADOR
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 leading-normal break-words">
                    {resultado.nombre}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-heading">
                    ID DE TRABAJADOR
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 font-mono leading-normal">
                    {resultado.trabajadorId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-heading">
                    RUT
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 font-mono leading-normal">
                    {resultado.rut || "No registrado"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-heading">
                    CORREO
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 break-all leading-normal overflow-visible">
                    {resultado.email || "No registrado"}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                <div className="w-1.5 h-3.5 bg-slate-500 rounded-sm"></div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-heading">
                  INGRESOS
                </span>
              </div>
              <div className="px-5 py-3.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-700 font-medium">Total facturado</span>
                  <span className="font-bold text-slate-900 text-base font-mono">
                    ${resultado.totalFacturado.toLocaleString("es-CL")}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                <div className="w-1.5 h-3.5 bg-slate-500 rounded-sm"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-heading">
                  DESCUENTOS
                </span>
              </div>
              <div className="px-5 py-3.5 space-y-2.5 text-sm">
                {resultado.descuentosPrimarios.map((d, i) => (
                  <div key={`prim-${i}`} className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">{d.concepto}</span>
                    <span className="font-semibold text-red-600 font-mono">
                      $-{Math.abs(d.monto).toLocaleString("es-CL")}
                    </span>
                  </div>
                ))}

                {resultado.descuentosSecundarios.length > 0 && (
                  <>
                    <div className="border-b border-dotted border-slate-300 my-2.5"></div>
                    {resultado.descuentosSecundarios.map((d, i) => (
                      <div key={`sec-${i}`} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-medium">{d.concepto}</span>
                        <span className="font-semibold text-red-600 font-mono">
                          $-{Math.abs(d.monto).toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-100 text-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="space-y-2 pb-3.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-slate-900">
                    ${(resultado.totalFacturado ?? resultado.subtotal).toLocaleString("es-CL")}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total descuentos</span>
                  <span className="font-mono font-medium text-red-600">
                    -${resultado.totalDescuentos.toLocaleString("es-CL")}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 my-3.5 pt-3.5 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-slate-700 font-heading">
                  TOTAL A PAGAR
                </span>
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {resultado.totalAPagar < 0
                    ? `$-${Math.abs(resultado.totalAPagar).toLocaleString("es-CL")}`
                    : `$${resultado.totalAPagar.toLocaleString("es-CL")}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 sm:px-10 sm:pb-10 pt-6">
          <div className="flex justify-between items-end text-[10px] text-slate-500">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 block uppercase text-xs font-heading">
                TRANSPORTES EL MONTAÑEZ
              </span>
              <span className="block">
                RUT 77.611.481-2 · Documento generado electrónicamente
              </span>
              <span className="block text-slate-500">
                Si tiene dudas sobre esta liquidación, contacte a administración.
              </span>
            </div>
            <div className="text-right space-y-1">
              <span className="font-semibold text-slate-700 block text-xs">
                {resultado.nombre}
              </span>
              <span className="block capitalize">
                {mes} · {fecha}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación y Resultados FirmaWeb */}
      <Dialog open={modalFirmaOpen} onOpenChange={setModalFirmaOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {!firmantesResultado ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <PenTool className="h-5 w-5 text-emerald-600" />
                  Certificación Oficial del Empleador (FirmaWeb)
                </DialogTitle>
                <DialogDescription>
                  Conforme a la legislación laboral chilena, firmarás electrónicamente esta liquidación como empleador (Transportes El Montañez SpA). El documento quedará certificado y legalmente blindado.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-sm">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trabajador:</span>
                    <span className="font-medium">{resultado.nombre} ({resultado.trabajadorId})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RUT Trabajador:</span>
                    <span>{resultado.rut}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total a Pagar:</span>
                    <span className="font-bold text-foreground">{MONEDA.format(resultado.totalAPagar)}</span>
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
                      Esta operación consumirá 1 firma FES. El PIN de verificación llegará a <strong>benhantscheruk@gmail.com</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setModalFirmaOpen(false)} disabled={enviandoFirma}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarFirmaWeb}
                  disabled={enviandoFirma || cargandoSaldo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                >
                  {enviandoFirma ? "Iniciando proceso..." : "Firma con FirmaWeb"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  ¡Proceso #{procesoIdExitoso} Listo para tu Firma!
                </DialogTitle>
                <DialogDescription>
                  1. Abre FirmaWeb y rubrica como empleador. 2. Cuando recibas el PDF firmado en tu correo, súbelo aquí abajo para enviárselo al conductor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {firmantesResultado && firmantesResultado[0] && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-4 space-y-3">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-semibold text-emerald-900 block">
                          Paso 1: Firmar en FirmaWeb (Empleador)
                        </span>
                        <span className="text-emerald-700 text-[11px] block mt-0.5">
                          PIN y PDF firmado enviados a: <strong>benhantscheruk@gmail.com</strong>
                        </span>
                      </div>
                      <Badge className="bg-emerald-600 text-white text-[10px]">1 Firma FES</Badge>
                    </div>

                    <Button
                      size="lg"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm font-semibold shadow-md py-6"
                      asChild
                    >
                      <a href={firmantesResultado[0].Url} target="_blank" rel="noopener noreferrer">
                        <PenTool className="h-5 w-5" />
                        Abrir y Firmar en FirmaWeb Ahora
                      </a>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs w-full"
                      onClick={() => handleCopiarUrl(firmantesResultado[0].Url, 0)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiadoIdx === 0 ? "¡Enlace copiado al portapapeles!" : "Copiar Enlace de Firma"}
                    </Button>
                  </div>
                )}

                {/* Paso 2: Subir manualmente el PDF firmado que llega al correo */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50 p-4 space-y-3">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Paso 2: Subir y enviar PDF firmado al conductor
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Una vez que firmes, FirmaWeb te enviará al correo el PDF firmado. Adjúntalo aquí para enviarlo al portal de{" "}
                      <strong>{resultado.nombre}</strong>.
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
                      disabled={!archivoPdfFirmado || enviando}
                      onClick={handleSubirYEnviarPdfFirmado}
                      className="w-full gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {enviando
                        ? "Subiendo y enviando al conductor..."
                        : "Enviar liquidación firmada al conductor"}
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalFirmaOpen(false)} className="w-full">
                  Cerrar (dejar en pendientes por ahora)
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal directo para subir y enviar el PDF firmado al conductor */}
      <Dialog open={modalSubirPdfOpen} onOpenChange={setModalSubirPdfOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-emerald-600" />
              Enviar PDF firmado al conductor
            </DialogTitle>
            <DialogDescription>
              Adjunta el documento PDF firmado que recibiste en{" "}
              <strong>benhantscheruk@gmail.com</strong> tras firmar en FirmaWeb para enviarlo a{" "}
              <strong>{resultado.nombre}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conductor:</span>
                <span className="font-semibold">
                  {resultado.nombre} ({resultado.trabajadorId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Período:</span>
                <span className="capitalize">{mes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total a pagar:</span>
                <span className="font-bold">{MONEDA.format(resultado.totalAPagar)}</span>
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setModalSubirPdfOpen(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubirYEnviarPdfFirmado}
              disabled={!archivoPdfFirmado || enviando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Send className="h-4 w-4" />
              {enviando ? "Enviando..." : "Enviar al conductor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
