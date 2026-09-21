import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, FileDown, PenLine, Send, SendToBack } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type ResultadoNomina } from "@/lib/nomina";
import { useAuth } from "@/features/auth/context/AuthContext";
import { enviarLiquidacion, guardarFirmaLiquidacion } from "@/features/nomina/services/liquidacionesService";
import { firmaWebDisponible } from "@/features/nomina/services/firmaWebAuthService";
import { extraerUrlsFirma, FirmaWebService, type UrlFirma } from "@/features/nomina/services/firmaWebService";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import LiquidacionDocument, { LIQUIDACION_A4 } from "./LiquidacionDocument";

interface NominaResultProps {
  resultado: ResultadoNomina;
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result;
      if (typeof resultado === "string") {
        const coma = resultado.indexOf(",");
        resolve(coma >= 0 ? resultado.slice(coma + 1) : resultado);
      } else {
        reject(new Error("No se pudo leer el PDF como Base64."));
      }
    };
    lector.onerror = () => reject(lector.error ?? new Error("Error al leer el PDF."));
    lector.readAsDataURL(blob);
  });
}

type ProcesoFirmaUI = {
  IdProceso: string;
  IdGrupo: string;
  IdDocumento: string;
};

function dividirNombre(nombreCompleto: string): {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
} {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) {
    return { nombre: partes[0] ?? nombreCompleto, apellidoPaterno: "", apellidoMaterno: "" };
  }
  if (partes.length === 2) {
    return { nombre: partes[0], apellidoPaterno: partes[1], apellidoMaterno: "" };
  }
  const apellidoMaterno = partes[partes.length - 1];
  const apellidoPaterno = partes[partes.length - 2];
  const nombre = partes.slice(0, partes.length - 2).join(" ");
  return { nombre, apellidoPaterno, apellidoMaterno };
}

function DocumentPreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / LIQUIDACION_A4.width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      <div data-testid="liquidacion-preview" className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
        <div style={{ height: LIQUIDACION_A4.height * scale }}>
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: LIQUIDACION_A4.width,
              height: LIQUIDACION_A4.height,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NominaResult({ resultado }: NominaResultProps) {
  const { profile } = useAuth();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [procesoFirma, setProcesoFirma] = useState<ProcesoFirmaUI | null>(null);
  const [firmaLista, setFirmaLista] = useState(() => firmaWebDisponible());
  const [urlsFirma, setUrlsFirma] = useState<UrlFirma[]>([]);
  const [firmaDialogOpen, setFirmaDialogOpen] = useState(false);
  const { toast } = useToast();
  const now = new Date();

  useEffect(() => {
    setFirmaLista(firmaWebDisponible());
  }, []);
  const mes = now.toLocaleDateString("es-CL", { month: "long" });
  const fecha = now.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const generarPDF = async (): Promise<Blob | null> => {
    if (!pdfRef.current) return null;
    await document.fonts.ready;
    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: LIQUIDACION_A4.width,
      height: LIQUIDACION_A4.height,
      windowWidth: LIQUIDACION_A4.width,
      windowHeight: LIQUIDACION_A4.height,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF("p", "mm", "a4");
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
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

  const handleEnviarCorreo = async () => {
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

      const asunto = encodeURIComponent(`Liquidación ${resultado.nombre} - ${mes}`);
      const cuerpo = encodeURIComponent(
        `Estimado/a,\n\nAdjunto la liquidación de ${resultado.nombre} (${resultado.trabajadorId}) correspondiente al mes de ${mes}.\n\nSaludos,\nTransportes El Montañez`
      );
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=&su=${asunto}&body=${cuerpo}`, "_blank");
    } catch {
      // Silencioso
    } finally {
      setDescargando(false);
    }
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

  const handleFirmarFirmaWeb = async () => {
    setFirmando(true);
    try {
      const blob = await generarPDF();
      if (!blob) return;
      const pdfBase64 = await blobABase64(blob);
      const servicio = FirmaWebService.getInstance();

      const adminNombre = profile?.full_name?.trim() ||
        [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno].filter(Boolean).join(" ").trim();
      const adminRut = profile?.rut?.trim();
      const adminEmail = profile?.email?.trim();
      if (!adminRut || !adminEmail || !adminNombre) {
        throw new Error("Completa tu RUT, nombre y email en tu perfil para poder firmar.");
      }
      const admin = dividirNombre(adminNombre);
      const trabajador = dividirNombre(resultado.nombre);

      const proceso = await servicio.crearProceso({
        nombre: `Liquidación ${resultado.nombre} - ${mes}`,
        notificar: 1,
        hojaFinal: 1,
      });
      const documento = await servicio.agregarDocumento(
        proceso.IdProceso,
        proceso.IdGrupo,
        pdfBase64,
        `liquidacion-${resultado.trabajadorId}-${now.toISOString().slice(0, 10)}.pdf`,
      );

      await servicio.agregarFirmante(proceso.IdProceso, proceso.IdGrupo, {
        ...admin,
        apellidoMaterno: admin.apellidoMaterno || undefined,
        rut: adminRut,
        email: adminEmail,
        tipoFirma: 2,
      });
      await servicio.agregarFirmante(proceso.IdProceso, proceso.IdGrupo, {
        ...trabajador,
        apellidoMaterno: trabajador.apellidoMaterno || undefined,
        rut: resultado.rut,
        email: resultado.email,
        tipoFirma: 2,
      });

      const base = window.location.origin.replace(/\/$/, "");
      const urlNotifica =
        import.meta.env.VITE_FIRMAWEB_URL_NOTIFICA || `${base}/api/webhooks/firmaweb`;
      const respuesta = await servicio.iniciarProceso(
        proceso.IdProceso,
        `${base}/firma/exito`,
        `${base}/firma/cancelado`,
        urlNotifica,
      );

      setProcesoFirma({
        IdProceso: proceso.IdProceso,
        IdGrupo: proceso.IdGrupo,
        IdDocumento: documento.IdDocumento,
      });

      const urls = extraerUrlsFirma(respuesta);
      const urlTrabajador = urls.find(
        (u) => u.rut === resultado.rut || (u.email ?? "").toLowerCase() === (resultado.email ?? "").toLowerCase(),
      ) ?? urls[0];

      if (urlTrabajador) {
        const filas = await guardarFirmaLiquidacion(resultado.trabajadorId, mes, {
          firma_url: urlTrabajador.url,
          firma_id_documento: documento.IdDocumento,
          firma_id_proceso: proceso.IdProceso,
        });
        if (filas > 0) {
          toast({
            title: "Proceso de firma iniciado",
            description: `El enlace de firma quedó disponible para ${resultado.nombre}.`,
          });
        } else {
          toast({
            title: "Proceso de firma iniciado",
            description:
              "No se encontró la liquidación enviada: envía la liquidación primero para que el trabajador pueda firmar desde su apartado.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Proceso de firma iniciado",
          description: `Documento ${documento.IdDocumento} enviado a firma (los firmantes reciben su enlace por correo).`,
        });
      }

      if (urls.length > 0) {
        setUrlsFirma(urls);
        setFirmaDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error en FirmaWeb",
        description: error instanceof Error ? error.message : "No se pudo iniciar el proceso de firma.",
        variant: "destructive",
      });
    } finally {
      setFirmando(false);
    }
  };

  const handleDescargarFirmado = async () => {
    if (!procesoFirma) return;
    setDescargando(true);
    try {
      const base64 = await FirmaWebService.getInstance().descargarDocumento(procesoFirma.IdDocumento);
      const binario = atob(base64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `liquidacion-firmada-${resultado.trabajadorId}-${now.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error al descargar PDF firmado",
        description: error instanceof Error ? error.message : "No se pudo descargar el documento firmado.",
        variant: "destructive",
      });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Badge variant={firmaLista ? "default" : "outline"} className="gap-1 self-center">
          <PenLine className="h-3 w-3" />
          {firmaLista ? "FirmaWeb listo" : "FirmaWeb sin configurar"}
        </Badge>
        {procesoFirma ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDescargarFirmado}
            disabled={descargando}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {descargando ? "Descargando..." : "Descargar PDF firmado"}
          </Button>
        ) : (
          firmaLista && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFirmarFirmaWeb}
              disabled={firmando}
              className="gap-2"
            >
              <PenLine className="h-4 w-4" />
              {firmando ? "Firmando..." : "Firmar en FirmaWeb"}
            </Button>
          )
        )}
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
      </div>

      <DocumentPreview>
        <LiquidacionDocument resultado={resultado} mes={mes} fecha={fecha} />
      </DocumentPreview>

      <div
        ref={pdfRef}
        data-testid="liquidacion-pdf-root"
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: LIQUIDACION_A4.width,
          height: LIQUIDACION_A4.height,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <LiquidacionDocument resultado={resultado} mes={mes} fecha={fecha} />
      </div>

      {procesoFirma && (
        <p className="text-xs text-muted-foreground">
          Documento <span className="font-medium">{procesoFirma.IdDocumento}</span> · Proceso{" "}
          {procesoFirma.IdProceso} · Grupo {procesoFirma.IdGrupo} — en flujo de firma electrónica.
        </p>
      )}

      <Dialog open={firmaDialogOpen} onOpenChange={setFirmaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Proceso de firma iniciado</DialogTitle>
            <DialogDescription>
              Ingresa al enlace de cada firmante para firmar el documento. El PDF final con ambas firmas
              queda disponible para ambos (tu copia aquí y la del trabajador en su apartado).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {urlsFirma.map((u, i) => {
              const esTrabajador =
                u.rut === resultado.rut ||
                (u.email ?? "").toLowerCase() === (resultado.email ?? "").toLowerCase();
              return (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {esTrabajador ? resultado.nombre : profile?.full_name ?? "Firmante"}
                      <span className="text-muted-foreground">
                        {esTrabajador ? " (trabajador)" : " (tú)"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.url}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={async () => {
                        await navigator.clipboard.writeText(u.url);
                        toast({ title: "Enlace copiado" });
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => window.open(u.url, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Firmar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirmaDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}