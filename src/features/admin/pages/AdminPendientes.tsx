import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { 
  Loader2, 
  RefreshCw, 
  Search, 
  DollarSign, 
  ShieldCheck, 
  CarFront,
  CheckCircle2,
  Clock,
  Users,
  PenTool
} from "lucide-react";
import { toast } from "sonner";
import { pendientesService, PendienteDetalle, EstadoPago } from "@/features/nomina/services/pendientesService";

export default function AdminPendientes() {
  const [data, setData] = useState<PendienteDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMes, setFilterMes] = useState<string>("Todos");
  const [filterEstadoGeneral, setFilterEstadoGeneral] = useState<string>("Todos");
  const [activeTab, setActiveTab] = useState<string>("general"); // general, sueldo, autopista, seguro

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await pendientesService.fetchPendientesPago();
      setData(result);
    } catch (error: any) {
      toast.error("Error al cargar pendientes", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleEstado = async (item: PendienteDetalle, parametro: "sueldo" | "autopista" | "seguro") => {
    const currentState = item[`estado_${parametro}` as keyof PendienteDetalle] as EstadoPago;
    const newState: EstadoPago = currentState === "pagado" ? "pendiente" : "pagado";
    
    // Optimistic update
    const prevData = [...data];
    setData(data.map(d => {
      if (d.liquidacion_id === item.liquidacion_id) {
        return {
          ...d,
          [`estado_${parametro}`]: newState,
          [`fecha_pago_${parametro}`]: newState === "pagado" ? new Date().toISOString() : null,
        };
      }
      return d;
    }));

    try {
      await pendientesService.updateEstadoPago(
        item.liquidacion_id,
        item.pendiente_id,
        parametro,
        newState
      );
      toast.success(`${parametro} marcado como ${newState}`);
    } catch (error: any) {
      toast.error("Error al actualizar", { description: error.message });
      // Revert on error
      setData(prevData);
    }
  };

  const mesesUnicos = [
    "Todos", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const dataFiltrada = useMemo(() => {
    return data.filter((item) => {
      const matchBuscador = 
        item.conductor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.conductor_rut.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchMes = filterMes === "Todos" || item.mes === filterMes;
      
      let matchEstado = true;
      if (filterEstadoGeneral !== "Todos") {
        const est = filterEstadoGeneral === "Pagados" ? "pagado" : "pendiente";
        
        const sueldoSaldado = item.estado_sueldo === "pagado" || item.monto_sueldo === 0;
        const autopistaSaldada = item.estado_autopista === "pagado" || item.monto_autopista === 0;
        const seguroSaldado = item.estado_seguro === "pagado" || item.monto_seguro === 0;

        if (activeTab === "general") {
          const todosSaldados = sueldoSaldado && autopistaSaldada && seguroSaldado;
          matchEstado = est === "pagado" ? todosSaldados : !todosSaldados;
        } else if (activeTab === "sueldo") {
          matchEstado = est === "pagado" ? sueldoSaldado : !sueldoSaldado;
        } else if (activeTab === "autopista") {
          matchEstado = est === "pagado" ? autopistaSaldada : !autopistaSaldada;
        } else if (activeTab === "seguro") {
          matchEstado = est === "pagado" ? seguroSaldado : !seguroSaldado;
        }
      }

      return matchBuscador && matchMes && matchEstado;
    });
  }, [data, searchTerm, filterMes, filterEstadoGeneral, activeTab]);

  // Resumen (KPIs) basado en filtros
  const kpis = useMemo(() => {
    let totalPendiente = 0;
    let sueldoPendiente = 0;
    let autopistaPendiente = 0;
    let seguroPendiente = 0;
    let conductoresConSueldoPendiente = 0;

    dataFiltrada.forEach(item => {
      if (item.estado_sueldo === "pendiente" && item.monto_sueldo > 0) {
        sueldoPendiente += item.monto_sueldo;
        totalPendiente += item.monto_sueldo;
        conductoresConSueldoPendiente++;
      }
      if (item.estado_autopista === "pendiente" && item.monto_autopista > 0) {
        autopistaPendiente += item.monto_autopista;
        totalPendiente += item.monto_autopista;
      }
      if (item.estado_seguro === "pendiente" && item.monto_seguro > 0) {
        seguroPendiente += item.monto_seguro;
        totalPendiente += item.monto_seguro;
      }
    });

    return { totalPendiente, sueldoPendiente, autopistaPendiente, seguroPendiente, conductoresConSueldoPendiente };
  }, [dataFiltrada]);

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(monto);
  };

  const renderBadge = (estado: EstadoPago, parametro: "sueldo" | "autopista" | "seguro", item: PendienteDetalle) => {
    const monto = item[`monto_${parametro}`];
    
    if (monto === 0) {
      return (
        <Badge variant="secondary" className="flex items-center justify-center gap-1.5 w-24 opacity-60">
          <CheckCircle2 className="w-3 h-3" />
          Saldado
        </Badge>
      );
    }

    const isPagado = estado === "pagado";
    return (
      <Badge
        variant={isPagado ? "default" : "destructive"}
        className={`cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5 w-24 ${
          isPagado ? "bg-green-600 hover:bg-green-700 text-white" : ""
        }`}
        onClick={() => handleToggleEstado(item, parametro)}
      >
        {isPagado ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {isPagado ? "Pagado" : "Pendiente"}
      </Badge>
    );
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pendientes por Pagar</h2>
          <p className="text-muted-foreground">
            Control de sueldos, autopistas (TAG) y seguros pendientes de pago.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">
            <Link to="/admin/nomina">
              <PenTool className="h-4 w-4 text-emerald-600" />
              Pendientes por firmar
            </Link>
          </Button>
          <Button onClick={fetchData} variant="outline" className="gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatearMonto(kpis.totalPendiente)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Suma de todos los parámetros</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sueldos Pendientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatearMonto(kpis.sueldoPendiente)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A {kpis.conductoresConSueldoPendiente} {kpis.conductoresConSueldoPendiente === 1 ? 'conductor' : 'conductores'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Autopistas (TAG)</CardTitle>
            <CarFront className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatearMonto(kpis.autopistaPendiente)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendiente de recuperación</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguros</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatearMonto(kpis.seguroPendiente)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendiente de recuperación</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Pagos</CardTitle>
          <CardDescription>
            Haz clic en los badges para cambiar el estado entre Pendiente y Pagado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" onValueChange={setActiveTab} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="general">Todos</TabsTrigger>
              <TabsTrigger value="sueldo">Sueldos</TabsTrigger>
              <TabsTrigger value="autopista">Autopistas</TabsTrigger>
              <TabsTrigger value="seguro">Seguros</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conductor o RUT..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {mesesUnicos.map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterEstadoGeneral} onValueChange={setFilterEstadoGeneral}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Pendientes">Pendientes</SelectItem>
                  <SelectItem value="Pagados">Pagados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Mes</TableHead>
                  {(activeTab === "general" || activeTab === "sueldo") && (
                    <TableHead className="min-w-[150px]">Sueldo</TableHead>
                  )}
                  {(activeTab === "general" || activeTab === "autopista") && (
                    <TableHead className="min-w-[150px]">Autopista</TableHead>
                  )}
                  {(activeTab === "general" || activeTab === "seguro") && (
                    <TableHead className="min-w-[150px]">Seguro</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataFiltrada.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron registros de pago.
                    </TableCell>
                  </TableRow>
                ) : (
                  dataFiltrada.map((item) => (
                    <TableRow key={item.liquidacion_id}>
                      <TableCell>
                        <div className="font-medium">{item.conductor_nombre}</div>
                        <div className="text-xs text-muted-foreground">{item.conductor_rut}</div>
                      </TableCell>
                      <TableCell>{item.mes} {item.anio}</TableCell>
                      
                      {(activeTab === "general" || activeTab === "sueldo") && (
                        <TableCell>
                          <div className="font-semibold mb-1">{formatearMonto(item.monto_sueldo)}</div>
                          {renderBadge(item.estado_sueldo, "sueldo", item)}
                        </TableCell>
                      )}
                      
                      {(activeTab === "general" || activeTab === "autopista") && (
                        <TableCell>
                          <div className="font-semibold mb-1">{formatearMonto(item.monto_autopista)}</div>
                          {renderBadge(item.estado_autopista, "autopista", item)}
                        </TableCell>
                      )}
                      
                      {(activeTab === "general" || activeTab === "seguro") && (
                        <TableCell>
                          <div className="font-semibold mb-1">{formatearMonto(item.monto_seguro)}</div>
                          {renderBadge(item.estado_seguro, "seguro", item)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
