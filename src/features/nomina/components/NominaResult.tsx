import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Mail, Fingerprint, FileDown, Send, SendToBack, PenTool, CheckCircle2, Copy, ExternalLink, ShieldCheck, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type ResultadoNomina } from "@/lib/nomina";
import { enviarLiquidacion } from "@/features/nomina/services/liquidacionesService";
import { consultarSaldoFirmaWeb, enviarAFirmaWeb, type FirmanteUrlInfo } from "@/features/firmaweb/services/supabaseFirmawebClient";
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
  maximumFractionDigits: 0,
});

interface NominaResultProps {
  resultado: ResultadoNomina;
}

function Fila({ concepto, monto, esTotal = false }: { concepto: string; monto: number; esTotal?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${esTotal ? "font-bold text-base" : "text-sm"}`}>
      <span>{concepto}</span>
      <span className={monto < 0 ? "text-destructive" : ""}>{MONEDA.format(monto)}</span>
    </div>
  );
}

export default function NominaResult({ resultado }: NominaResultProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
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

  const handleEnviarLiquidacion = async () => {
    setEnviando(true);
    try {
      const blob = await generarPDF();
      await enviarLiquidacion(resultado, mes, fecha, blob);
      toast({
        title: "Liquidación enviada",
        description: `Se envió la liquidación a ${resultado.nombre} (${resultado.trabajadorId}).`,
      });
    } catch (error) {
      toast({
        title: "Error al enviar liquidación",
        description: error instanceof Error ? error.message : "No se pudo enviar la liquidación.",
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
    setFirmantesResultado(null);
    setProcesoIdExitoso(null);
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

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1] || "";
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const pdfBase64 = await base64Promise;

      const res = await enviarAFirmaWeb(resultado, pdfBase64, mes);
      setProcesoIdExitoso(res.idProceso);
      setFirmantesResultado(res.firmantes);
      toast({
        title: "¡Proceso creado en FirmaWeb!",
        description: `Proceso #${res.idProceso} iniciado exitosamente. Ya visible en tu escritorio de FirmaWeb.`,
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnviarCorreo}
          disabled={descargando}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {descargando ? "Generando..." : "Enviar por correo"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          {descargando ? "Generando..." : "Descargar PDF"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleEnviarLiquidacion}
          disabled={enviando}
          className="gap-2"
        >
          <SendToBack className="h-4 w-4" />
          {enviando ? "Enviando..." : "Enviar liquidación"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleAbrirModalFirma}
          disabled={descargando || enviando || enviandoFirma}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <PenTool className="h-4 w-4" />
          Firmar con FirmaWeb
        </Button>
      </div>

      {/* DOCUMENTO LIQUIDACIÓN DE NÓMINA (A4 ESTRUCTURA EXACTA) */}
      <div
        ref={cardRef}
        style={{ width: "800px", minHeight: "1131px" }}
        className="mx-auto bg-white text-slate-900 font-sans flex flex-col justify-between border-0 rounded-none p-0 overflow-hidden shadow-2xl"
      >
        {/* PARTE SUPERIOR */}
        <div className="w-full m-0 p-0">
          {/* 1. ENCABEZADO OFICIAL OSCURO (Edge to edge full bleed) */}
          <div className="w-full bg-slate-700 text-white px-10 py-7 rounded-none m-0 border-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* Logo Login modo claro + Nombre Empresa */}
              <div className="flex items-center gap-4">
                <img
                  src={LOGO_APP_BASE64}
                  alt="Transportes El Montañez"
                  className="h-12 w-12 rounded-xl object-contain shrink-0 shadow-md"
                />
                <div>
                  <h2 className="text-2xl font-bold tracking-wide uppercase text-white leading-none font-body">
                    TRANSPORTES EL MONTAÑEZ
                  </h2>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase mt-1 font-body">
                    LIQUIDACIÓN DE NÓMINA
                  </p>
                </div>
              </div>

              {/* Documento Oficial + Mes */}
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-semibold tracking-wider text-slate-300 uppercase block font-body">
                  DOCUMENTO OFICIAL
                </span>
                <span className="text-3xl font-bold capitalize text-white tracking-tight block leading-tight font-body">
                  {mes}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Emitido el {fecha}
                </span>
              </div>
            </div>
          </div>

          {/* CUERPO PRINCIPAL */}
          <div className="p-8 sm:p-10 space-y-5 bg-white">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 items-start">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block font-body">
                    TRABAJADOR
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 leading-snug">
                    {resultado.nombre}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block font-body">
                    ID DE TRABAJADOR
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 font-mono">
                    {resultado.trabajadorId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block font-body">
                    RUT
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 font-mono">
                    {resultado.rut || "No registrado"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block font-body">
                    CORREO
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 truncate">
                    {resultado.email || "No registrado"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block font-body">
                    VEHÍCULO
                  </span>
                  <span className="text-xs font-bold text-slate-900 block mt-1 leading-normal">
                    {resultado.vehicle_plate ? `${resultado.vehicle_plate}${resultado.vehicle_make || resultado.vehicle_model ? ` | ${[resultado.vehicle_make, resultado.vehicle_model].filter(Boolean).join(' ')}${resultado.vehicle_year ? ` (${resultado.vehicle_year})` : ''}` : ''}` : "Sin vehículo"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. SECCIÓN: INGRESOS */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 font-body">
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

            {/* 4. SECCIÓN: DESCUENTOS */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-[#f8fafc] border-b border-slate-200/80 px-4 py-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 font-body">
                  DESCUENTOS
                </span>
              </div>
              <div className="px-5 py-3.5 space-y-2.5 text-sm">
                {resultado.descuentosPrimarios.map((d, i) => (
                  <div key={`prim-${i}`} className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">{d.concepto}</span>
                    <span className="font-semibold text-slate-700 font-mono">
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
                        <span className="font-semibold text-slate-700 font-mono">
                          $-{Math.abs(d.monto).toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* 5. RESUMEN DE TOTALES */}
            <div className="rounded-2xl border border-slate-300 bg-slate-100 p-6 text-slate-900 shadow-sm">
              <div className="space-y-2 pb-3.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-slate-800">
                    ${resultado.subtotal.toLocaleString("es-CL")}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total descuentos</span>
                  <span className="font-mono font-medium text-slate-700">
                    -${resultado.totalDescuentos.toLocaleString("es-CL")}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-300 my-3.5 pt-3.5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 font-body">
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

        {/* 6. PIE DE PÁGINA (ESPACIO ELEGANTE Y FOOTER FORMAL) */}
        <div className="px-8 pb-8 sm:px-10 sm:pb-10 pt-6">
          <div className="flex justify-between items-end text-[10px] text-slate-400">
            <div className="space-y-1">
              <span className="font-semibold text-slate-700 block uppercase text-xs font-body">
                TRANSPORTES EL MONTAÑEZ
              </span>
              <span className="block">
                RUT 77.777.777-7 · Documento generado electrónicamente
              </span>
              <span className="block text-slate-400">
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
        <DialogContent className="sm:max-w-[480px]">
          {!firmantesResultado ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <PenTool className="h-5 w-5 text-emerald-600" />
                  Enviar a Firma Electrónica (FirmaWeb)
                </DialogTitle>
                <DialogDescription>
                  Se creará un proceso oficial en FirmaWeb para que firmen el empleador y el conductor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-sm">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trabajador:</span>
                    <span className="font-medium">{resultado.nombre} ({resultado.trabajadorId})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RUT:</span>
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
                      Esta operación reservará 1 firma para este documento. Podrás revisar el estado en vivo desde tu panel de FirmaWeb.
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {enviandoFirma ? "Iniciando proceso..." : "Confirmar y Enviar a Firma"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  ¡Proceso #{procesoIdExitoso} Iniciado!
                </DialogTitle>
                <DialogDescription>
                  El documento ya está en FirmaWeb en estado <strong>Pendiente de Firma</strong>. Puedes firmar desde los enlaces directos:
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {firmantesResultado.map((firmante, idx) => (
                  <div key={idx} className="rounded-lg border p-3 text-xs space-y-1.5">
                    <div className="flex justify-between font-medium">
                      <span>{firmante.Email}</span>
                      <span className="text-muted-foreground">Firmante {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs flex-1"
                        onClick={() => handleCopiarUrl(firmante.Url, idx)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiadoIdx === idx ? "¡Copiado!" : "Copiar Enlace"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5 text-xs"
                        asChild
                      >
                        <a href={firmante.Url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={() => setModalFirmaOpen(false)} className="w-full">
                  Listo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
