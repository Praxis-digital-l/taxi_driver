import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import { FileText, Fingerprint, Wallet, Download, Eye, CheckCircle2, Clock } from "lucide-react";
import { fetchLiquidacionesByProfile, type LiquidacionRecord } from "@/features/nomina/services/liquidacionesService";

const MONEDA = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function Fila({ concepto, monto, esTotal = false }: { concepto: string; monto: number; esTotal?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${esTotal ? "font-bold text-base" : "text-sm"}`}>
      <span>{concepto}</span>
      <span className={monto < 0 ? "text-destructive" : ""}>{MONEDA.format(monto)}</span>
    </div>
  );
}

function DetalleLiquidacion({ liquidacion }: { liquidacion: LiquidacionRecord }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Fingerprint className="h-3 w-3" /> {liquidacion.worker_id}
        </span>
        <span>{liquidacion.mes}</span>
        <span>{liquidacion.fecha}</span>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ingresos</h4>
        <Fila concepto="Total facturado" monto={liquidacion.total_facturado} />
      </div>

      <Separator />

      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Descuentos</span>
        {(() => {
          // Agrupar entradas TAG en una sola fila sumada
          const tagEntries = liquidacion.descuentos_primarios.filter((d) =>
            d.concepto.toLowerCase().startsWith("tag")
          );
          const nonTagEntries = liquidacion.descuentos_primarios.filter(
            (d) => !d.concepto.toLowerCase().startsWith("tag")
          );
          const totalTag = tagEntries.reduce((sum, d) => sum + (Number(d.monto) || 0), 0);

          return (
            <>
              {nonTagEntries.map((d, i) => (
                <Fila key={`prim-${i}`} concepto={d.concepto} monto={-d.monto} />
              ))}
              {totalTag > 0 && (
                <Fila concepto="TAG (Autopistas)" monto={-totalTag} />
              )}
            </>
          );
        })()}
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

      <Fila concepto="Subtotal" monto={liquidacion.total_facturado ?? liquidacion.subtotal} />
      <Separator />
      <Fila concepto="Total descuentos" monto={-liquidacion.total_descuentos} />
      <Separator />

      <div className="bg-primary/5 -mx-6 -mb-6 px-6 py-4 mt-2 rounded-b-lg">
        <Fila concepto="Total a pagar" monto={liquidacion.total_a_pagar} esTotal />
      </div>

      {/* Estado de Firma y Botones de Acción */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div>
          {liquidacion.firma_estado === "firmada" ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5 py-1 px-3 shadow-sm">
              <CheckCircle2 className="h-4 w-4" /> Certificada por Empleador
            </Badge>
          ) : liquidacion.firma_estado === "pendiente" ? (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50/80 gap-1.5 py-1 px-3">
              <Clock className="h-3.5 w-3.5" /> En proceso de certificación
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Opciones de Ver y Descargar PDF */}
          {liquidacion.file_url && (
            <>
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
            </>
          )}
        </div>
      </div>
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
                      {liq.firma_estado === "firmada" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 text-[10px] py-0 px-2 font-medium">
                          Certificada
                        </Badge>
                      )}
                      {liq.firma_estado === "pendiente" && (
                        <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20 text-[10px] py-0 px-2 font-medium">
                          Por Certificar
                        </Badge>
                      )}
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
