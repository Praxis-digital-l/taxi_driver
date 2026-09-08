import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import {
  fetchAllLiquidaciones,
  calcularResumenFinanciero,
  type LiquidacionRecord,
  type FinancialSummary,
} from "@/features/nomina/services/liquidacionesService";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Fuel,
  Shield,
  Wrench,
  Briefcase,
  HandCoins,
  BadgeDollarSign,
  KeyRound,
  RotateCcw,
  Search,
  FileText,
  Calendar,
  ExternalLink,
  Calculator,
  RefreshCw,
  Layers,
} from "lucide-react";

const formatCLP = (val: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export default function AdminFinanzas() {
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllLiquidaciones();
      setLiquidaciones(data);
    } catch (err) {
      console.warn("Error cargando liquidaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const mesesDisponibles = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  // Filtrado por mes y texto de búsqueda
  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones.filter((liq) => {
      const cumpleMes = filtroMes === "todos" || liq.mes === filtroMes;
      const q = busqueda.toLowerCase().trim();
      const cumpleBusqueda =
        !q ||
        (liq.nombre && liq.nombre.toLowerCase().includes(q)) ||
        (liq.rut && liq.rut.toLowerCase().includes(q)) ||
        (liq.worker_id && liq.worker_id.toLowerCase().includes(q));
      return cumpleMes && cumpleBusqueda;
    });
  }, [liquidaciones, filtroMes, busqueda]);

  // Resumen financiero del período seleccionado
  const resumen: FinancialSummary = useMemo(() => {
    return calcularResumenFinanciero(liquidacionesFiltradas);
  }, [liquidacionesFiltradas]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalle de Ingresos y Egresos"
        description="Balance financiero consolidado, salidas de dinero, recuperaciones operacionales e ingreso interno"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>

          <Link to="/admin/nomina">
            <Button size="sm" className="gap-1.5 text-xs h-9">
              <Calculator className="h-3.5 w-3.5" />
              Nueva Nómina
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* FILTROS Y CONTROLES */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-card shadow-sm">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por conductor, RUT o ID..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="w-48">
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="h-9 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {mesesDisponibles.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Badge variant="secondary" className="self-end sm:self-auto font-mono text-xs">
          {liquidacionesFiltradas.length} liquidación(es) considerada(s)
        </Badge>
      </div>

      {/* TARJETAS PRINCIPALES DE RESUMEN (KPIS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. EGRESO TOTAL */}
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <ArrowDownRight className="h-4 w-4" /> Egreso (Salida)
              </span>
              <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 bg-rose-500/10">
                A pagar
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatCLP(resumen.totalAPagar)}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Total neto a pagar a los conductores
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 2. TOTAL FACTURADO (INGRESO) */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4" /> Ingreso Facturado
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                Facturación
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatCLP(resumen.totalFacturado)}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Total bruto generado por la flota
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 3. RECUPERACIONES TOTALES */}
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4" /> Recuperaciones
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10">
                Gastos + Deudas
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatCLP(resumen.totalRecuperaciones)}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Diesel, mantención, seguros y préstamos
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 4. INGRESO INTERNO (ARRIENDO) */}
        <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> Ingreso Interno
              </span>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-500/10">
                Arriendos
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatCLP(resumen.ingresoInterno.total)}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Alquiler de vehículos ingresado a la empresa
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* BLOQUES DE DETALLE EXACTOS SEGÚN REQUERIMIENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: EGRESOS (SALIDA DE DINERO) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-l-4 border-l-rose-500 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="h-5 w-5" />
                  Egreso (Salida de dinero)
                </CardTitle>
                <Badge variant="destructive" className="text-[11px]">
                  Desembolso
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Monto que la administración transfiere o paga a los conductores
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {/* TOTAL A PAGAR */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Total a pagar</span>
                  <span className="font-mono text-xl font-bold text-rose-600 dark:text-rose-400">
                    {formatCLP(resumen.totalAPagar)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Corresponde al resultado neto final a liquidar a los conductores tras deducir los gastos
                  operacionales, deudas y el arriendo de los vehículos.
                </p>
              </div>

              {/* Métrica de porcentaje sobre facturación */}
              {resumen.totalFacturado > 0 && (
                <div className="rounded-lg bg-card border p-3 text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Participación sobre facturado:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {((resumen.totalAPagar / resumen.totalFacturado) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((resumen.totalAPagar / resumen.totalFacturado) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: INGRESOS Y RECUPERACIONES */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                  Ingresos y Recuperaciones
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
                  Flujo Positivo
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Detalle de facturación bruta, recuperación de costos y arriendos percibidos
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {/* 1. TOTAL FACTURADO (INGRESO) */}
              <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Total facturado (Ingreso)
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Facturación total bruta generada por las carreras y servicios
                  </p>
                </div>
                <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCLP(resumen.totalFacturado)}
                </span>
              </div>

              <Separator />

              {/* 2. RECUPERACIÓN DE GASTOS */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                    Recuperación de gastos
                  </span>
                  <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                    {formatCLP(resumen.recuperacionGastos.total)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Diesel */}
                  <div className="rounded-lg border bg-card p-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Fuel className="h-3.5 w-3.5 text-amber-500" /> Diesel
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCLP(resumen.recuperacionGastos.diesel)}
                    </span>
                  </div>

                  {/* Seguro */}
                  <div className="rounded-lg border bg-card p-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 text-blue-500" /> Seguro
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCLP(resumen.recuperacionGastos.seguro)}
                    </span>
                  </div>

                  {/* Mantención */}
                  <div className="rounded-lg border bg-card p-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5 text-orange-500" /> Mantención
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCLP(resumen.recuperacionGastos.mantencion)}
                    </span>
                  </div>

                  {/* Gasto operacional */}
                  <div className="rounded-lg border bg-card p-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5 text-purple-500" /> Gasto operacional
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCLP(resumen.recuperacionGastos.gastoOperacional)}
                    </span>
                  </div>

                  {/* TAG si existe monto */}
                  {resumen.recuperacionGastos.tag > 0 && (
                    <div className="sm:col-span-2 rounded-lg border bg-card p-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Layers className="h-3.5 w-3.5 text-sky-500" /> Peajes / TAG
                      </span>
                      <span className="font-mono font-semibold">
                        {formatCLP(resumen.recuperacionGastos.tag)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* 3. RECUPERACIÓN DE DEUDAS */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <HandCoins className="h-3.5 w-3.5 text-indigo-500" />
                    Recuperación de deudas
                  </span>
                  <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCLP(resumen.recuperacionDeudas.total)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Anticipo */}
                  <div className="rounded-lg border bg-card p-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <BadgeDollarSign className="h-3.5 w-3.5 text-indigo-500" /> Anticipo
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCLP(resumen.recuperacionDeudas.anticipo)}
                    </span>
                  </div>

                  {/* Préstamo */}
                  <div className="rounded-lg border bg-card p-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <HandCoins className="h-3.5 w-3.5 text-violet-500" /> Préstamo
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCLP(resumen.recuperacionDeudas.prestamo)}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 4. INGRESO INTERNO (ARRIENDO) */}
              <div className="rounded-xl border bg-blue-500/5 border-blue-500/20 p-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                    <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Ingreso interno (Arriendo)
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Cobro por alquiler de vehículos percibido directamente por la empresa
                  </p>
                </div>
                <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatCLP(resumen.ingresoInterno.total)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TABLA DE DESGLOSE POR CONDUCTOR */}
      <Card className="shadow-sm">
        <CardHeader className="border-b pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-heading">
                Detalle por Conductor y Liquidación
              </CardTitle>
              <CardDescription className="text-xs">
                Historial desglosado de ingresos facturados, gastos deducidos y montos netos a pagar
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Cargando detalle de ingresos y egresos...
            </div>
          ) : liquidacionesFiltradas.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
              <p className="text-sm font-medium">No se encontraron liquidaciones para este período.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Las liquidaciones calculadas desde el módulo de Nómina aparecerán reflejadas aquí automáticamente con todo su desglose financiero.
              </p>
              <Link to="/admin/nomina">
                <Button size="sm" variant="outline" className="text-xs gap-1.5 mt-2">
                  <Calculator className="h-3.5 w-3.5" /> Ir a Cálculo de Nómina
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Fecha / Mes</TableHead>
                    <TableHead>Conductor</TableHead>
                    <TableHead className="text-right">Total Facturado</TableHead>
                    <TableHead className="text-right">Recup. Gastos</TableHead>
                    <TableHead className="text-right">Recup. Deudas</TableHead>
                    <TableHead className="text-right">Ingreso Arriendo</TableHead>
                    <TableHead className="text-right font-semibold text-rose-600 dark:text-rose-400">
                      Total a Pagar (Egreso)
                    </TableHead>
                    <TableHead className="text-center w-20">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {liquidacionesFiltradas.map((liq) => {
                    const gastosLiq = (liq.descuentos_primarios || [])
                      .filter((d) => {
                        const c = (d.concepto || "").toLowerCase();
                        return c.includes("diesel") || c.includes("seguro") || c.includes("gasto operacional") || c.includes("tag");
                      })
                      .reduce((s, d) => s + (Number(d.monto) || 0), 0) +
                      (liq.descuentos_secundarios || [])
                        .filter((d) => (d.concepto || "").toLowerCase().includes("mantenci"))
                        .reduce((s, d) => s + (Number(d.monto) || 0), 0);

                    const deudasLiq = (liq.descuentos_secundarios || [])
                      .filter((d) => {
                        const c = (d.concepto || "").toLowerCase();
                        return c.includes("anticipo") || c.includes("prestamo") || c.includes("préstamo");
                      })
                      .reduce((s, d) => s + (Number(d.monto) || 0), 0);

                    const arriendoLiq = (liq.descuentos_primarios || [])
                      .filter((d) => (d.concepto || "").toLowerCase().includes("arriendo"))
                      .reduce((s, d) => s + (Number(d.monto) || 0), 0);

                    return (
                      <TableRow key={liq.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono">
                          <span className="font-medium block">{liq.fecha || liq.created_at.slice(0, 10)}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">{liq.mes}</span>
                        </TableCell>

                        <TableCell>
                          <span className="font-semibold block text-foreground">{liq.nombre}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {liq.rut || `ID: ${liq.worker_id}`}
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCLP(liq.total_facturado)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatCLP(gastosLiq)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {formatCLP(deudasLiq)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatCLP(arriendoLiq)}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatCLP(liq.total_a_pagar)}
                        </TableCell>

                        <TableCell className="text-center">
                          {liq.file_url ? (
                            <a
                              href={liq.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-primary"
                              title="Ver documento PDF"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
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
    </div>
  );
}

