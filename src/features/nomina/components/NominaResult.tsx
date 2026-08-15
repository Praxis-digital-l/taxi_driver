import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Mail, Fingerprint, FileDown, Send, SendToBack } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type ResultadoNomina } from "@/lib/nomina";
import { enviarLiquidacion } from "@/features/nomina/services/liquidacionesService";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
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
        `Estimado/a,\n\nAdjunto la liquidación de ${resultado.nombre} (${resultado.trabajadorId}) correspondiente al mes de ${mes}.\n\nSaludos,\nSanta Aurora`
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
      </div>

      <div ref={cardRef}>
        <Card className="border-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-lg">Liquidación mes {mes}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{resultado.nombre}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{resultado.trabajadorId}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 min-w-0">
                    <Mail className="h-3 w-3 shrink-0" /> <span className="break-all">{resultado.email}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Fingerprint className="h-3 w-3" /> {resultado.rut}
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
                <p className="font-medium text-foreground">Santa Aurora</p>
                <p>77.777.777-7</p>
                <p>{fecha}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ingresos</h4>
              <Fila concepto="Total facturado" monto={resultado.totalFacturado} />
            </div>

            <Separator />

            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Descuentos</span>
              {resultado.descuentosPrimarios.map((d, i) => (
                <Fila key={`prim-${i}`} concepto={d.concepto} monto={-d.monto} />
              ))}
              {resultado.descuentosSecundarios.length > 0 && (
                <>
                  <div className="my-1.5 border-t border-dashed border-muted-foreground/20" />
                  {resultado.descuentosSecundarios.map((d, i) => (
                    <Fila key={`sec-${i}`} concepto={d.concepto} monto={-d.monto} />
                  ))}
                </>
              )}
            </div>

            <Separator />

            <Fila concepto="Subtotal" monto={resultado.subtotal} />
            <Separator />
            <Fila concepto="Total descuentos" monto={-resultado.totalDescuentos} />
            <Separator />

            <div className="bg-primary/5 -mx-6 -mb-6 px-6 py-4 mt-2 rounded-b-lg">
              <Fila concepto="Total a pagar" monto={resultado.totalAPagar} esTotal />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
