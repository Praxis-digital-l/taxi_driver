import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import { FileText, Fingerprint, Wallet, Download, Eye, PenLine } from "lucide-react";
import {
  FIRMA_FIRMADA,
  FIRMA_RECHAZADA,
  fetchLiquidacionesByProfile,
  type LiquidacionRecord,
} from "@/features/nomina/services/liquidacionesService";
import { FirmaWebService } from "@/features/nomina/services/firmaWebService";

const MONEDA = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function estadoFirma(estado: number): { texto: string; variante: "default" | "outline" | "destructive" } {
  if (estado === FIRMA_FIRMADA) return { texto: "Firmada", variante: "default" };
  if (estado === FIRMA_RECHAZADA) return { texto: "Rechazada", variante: "destructive" };
  return { texto: "Pendiente de firma", variante: "outline" };
}

function Fila({ concepto, monto, esTotal = false }: { concepto: string; monto: number; esTotal?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${esTotal ? "font-bold text-base" : "text-sm"}`}>
      <span>{concepto}</span>
      <span className={monto < 0 ? "text-destructive" : ""}>{MONEDA.format(monto)}</span>
    </div>
  );
}

function DetalleLiquidacion({ liquidacion }: { liquidacion: LiquidacionRecord }) {
  const [descargandoFirmado, setDescargandoFirmado] = useState(false);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);
  const firma = estadoFirma(liquidacion.firma_estado);

  const handleDescargarFirmado = async () => {
    if (!liquidacion.firma_id_documento) return;
    setDescargandoFirmado(true);
    setErrorFirma(null);
    try {
      const base64 = await FirmaWebService.getInstance().descargarDocumento(liquidacion.firma_id_documento);
      const binario = atob(base64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `liquidacion-firmada-${liquidacion.worker_id}-${liquidacion.mes}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorFirma(error instanceof Error ? error.message : "No se pudo descargar el PDF firmado.");
    } finally {
      setDescargandoFirmado(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Fingerprint className="h-3 w-3" /> {liquidacion.worker_id}
        </span>
        <span>{liquidacion.mes}</span>
        <span>{liquidacion.fecha}</span>
        <Badge variant={firma.variante} className="shrink-0">
          {firma.texto}
        </Badge>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ingresos</h4>
        <Fila concepto="Total facturado" monto={liquidacion.total_facturado} />
      </div>

      <Separator />

      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Descuentos</span>
        {liquidacion.descuentos_primarios.map((d, i) => (
          <Fila key={`prim-${i}`} concepto={d.concepto} monto={-d.monto} />
        ))}
        {liquidacion.descuentos_secundarios.length > 0 && (
          <>
            <div className="my-1.5 border-t border-dashed border-muted-foreground/20" />
            {liquidacion.descuentos_secundarios.map((d, i) => (
              <Fila key={`sec-${i}`} concepto={d.concepto} monto={-d.monto} />
            ))}
          </>
        )}
      </div>

      <Separator />

      <Fila concepto="Subtotal" monto={liquidacion.subtotal} />
      <Separator />
      <Fila concepto="Total descuentos" monto={-liquidacion.total_descuentos} />
      <Separator />

      <div className="bg-primary/5 -mx-6 -mb-6 px-6 py-4 mt-2 rounded-b-lg">
        <Fila concepto="Total a pagar" monto={liquidacion.total_a_pagar} esTotal />
      </div>

      {liquidacion.file_url && (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open(liquidacion.file_url!, "_blank")}
          >
            <Eye className="h-4 w-4" /> Ver PDF
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-2"
            onClick={() => {
              const a = document.createElement("a");
              a.href = liquidacion.file_url!;
              a.download = `liquidacion-${liquidacion.worker_id}-${liquidacion.mes}.pdf`;
              a.click();
            }}
          >
            <Download className="h-4 w-4" /> Descargar PDF
          </Button>
        </div>
      )}

      {liquidacion.firma_url && liquidacion.firma_estado !== FIRMA_FIRMADA && (
        <div className="flex flex-wrap justify-end gap-2 rounded-lg bg-primary/5 px-3 py-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => window.open(liquidacion.firma_url!, "_blank")}
          >
            <PenLine className="h-4 w-4" /> Firmar ahora
          </Button>
        </div>
      )}

      {liquidacion.firma_estado === FIRMA_FIRMADA && liquidacion.firma_id_documento && (
        <div className="flex flex-col items-end gap-2 rounded-lg bg-primary/5 px-3 py-2">
          <Button
            size="sm"
            className="gap-2"
            variant="default"
            onClick={handleDescargarFirmado}
            disabled={descargandoFirmado}
          >
            <Download className="h-4 w-4" />
            {descargandoFirmado ? "Descargando..." : "Descargar PDF firmado"}
          </Button>
          {errorFirma && <p className="text-xs text-destructive">{errorFirma}</p>}
        </div>
      )}
    </div>
  );
}

export default function ConductorLiquidaciones() {
  const { profile } = useAuth();
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [detail, setDetail] = useState<LiquidacionRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetchLiquidacionesByProfile(profile.id)
      .then(setLiquidaciones)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las liquidaciones.");
      });
  }, [profile]);

  const openDetail = (liq: LiquidacionRecord) => {
    setDetail(liq);
    setDetailOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Liquidaciones"
        description={`${liquidaciones.length} liquidacion(es) recibida(s)`}
      />

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      {!error && liquidaciones.length === 0 ? (
        <Card><CardContent className="empty-state"><FileText /><p>No tienes liquidaciones aún.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {liquidaciones.map((liq) => (
            <Card key={liq.id} className="stat-card overflow-hidden cursor-pointer" onClick={() => openDetail(liq)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">Liquidación {liq.mes}</p>
                      <Badge variant="outline" className="text-xs shrink-0">{liq.worker_id}</Badge>
                      {(() => {
                        const f = estadoFirma(liq.firma_estado);
                        return (
                          <Badge variant={f.variante} className="text-xs shrink-0">{f.texto}</Badge>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{liq.fecha}</p>
                    {liq.file_url && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <Download className="h-3 w-3" /> PDF disponible
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                      <Wallet className="h-3 w-3" /> Total a pagar
                    </p>
                    <p className="text-lg font-bold font-heading">{MONEDA.format(liq.total_a_pagar)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Liquidación {detail?.mes}</DialogTitle>
          </DialogHeader>
          {detail && <DetalleLiquidacion liquidacion={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
