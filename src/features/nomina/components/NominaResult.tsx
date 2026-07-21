import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { type ResultadoNomina } from "@/lib/nomina";

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
  const totalPrimarios = resultado.descuentosPrimarios.reduce((s, d) => s + d.monto, 0);

  return (
    <Card className="border-primary/20">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Resultado de nómina</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {resultado.nombre} <Badge variant="outline" className="ml-2 text-xs">{resultado.trabajadorId}</Badge>
            </p>
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
  );
}
