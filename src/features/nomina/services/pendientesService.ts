import { supabase } from "@/integrations/supabase/client";

export type EstadoPago = "pendiente" | "pagado";

export interface PendientePago {
  id: string;
  liquidacion_id: string;
  estado_sueldo: EstadoPago;
  fecha_pago_sueldo: string | null;
  estado_autopista: EstadoPago;
  fecha_pago_autopista: string | null;
  estado_seguro: EstadoPago;
  fecha_pago_seguro: string | null;
  created_at: string;
  updated_at: string;
}

// Representación combinada para la UI
export interface PendienteDetalle {
  liquidacion_id: string;
  pendiente_id: string | null;
  conductor_nombre: string;
  conductor_rut: string;
  mes: string;
  anio: number;
  
  monto_sueldo: number;
  estado_sueldo: EstadoPago;
  fecha_pago_sueldo: string | null;

  monto_autopista: number;
  estado_autopista: EstadoPago;
  fecha_pago_autopista: string | null;

  monto_seguro: number;
  estado_seguro: EstadoPago;
  fecha_pago_seguro: string | null;
}

export const pendientesService = {
  async fetchPendientesPago(): Promise<PendienteDetalle[]> {
    // 1. Obtener todas las liquidaciones (con perfiles)
    const { data: liquidaciones, error: liqError } = await supabase
      .from("liquidaciones")
      .select(`
        *,
        profiles:profile_id (
          full_name,
          rut
        )
      `)
      .order("created_at", { ascending: false });

    if (liqError) throw liqError;

    // 2. Obtener todos los registros de estado en pendientes_pago
    const { data: estadosGuardados, error: estError } = await supabase
      .from("pendientes_pago")
      .select("*");

    if (estError) throw estError;

    const estadosMap = new Map<string, any>();
    if (estadosGuardados) {
      estadosGuardados.forEach((est) => {
        estadosMap.set(est.liquidacion_id, est);
      });
    }

    // 3. Combinar datos
    const resultados: PendienteDetalle[] = (liquidaciones || []).map((liq: any) => {
      const estadoInfo = estadosMap.get(liq.id);
      
      // Parsear descuentos para extraer seguro y autopista
      let monto_autopista = 0;
      let monto_seguro = 0;

      // Autopista y Seguro: extraer de los primarios
      if (Array.isArray(liq.descuentos_primarios)) {
        liq.descuentos_primarios.forEach((desc: any) => {
          const c = (desc.concepto || "").toLowerCase();
          if (c.includes("tag") || c.includes("autopista")) {
            monto_autopista += Number(desc.monto) || 0;
          }
          if (c.includes("seguro")) {
            monto_seguro += Number(desc.monto) || 0;
          }
        });
      }

      // Seguro: extraer de los secundarios (compatibilidad histórica)
      if (Array.isArray(liq.descuentos_secundarios)) {
        liq.descuentos_secundarios.forEach((desc: any) => {
          if ((desc.concepto || "").toLowerCase().includes("seguro")) {
            monto_seguro += Number(desc.monto) || 0;
          }
        });
      }

      const conductor = liq.profiles || {};

      return {
        liquidacion_id: liq.id,
        pendiente_id: estadoInfo?.id || null,
        conductor_nombre: conductor.full_name || "Desconocido",
        conductor_rut: conductor.rut || "",
        mes: liq.mes,
        anio: liq.anio || new Date(liq.created_at).getFullYear(),
        
        monto_sueldo: Number(liq.total_a_pagar) || 0,
        estado_sueldo: estadoInfo?.estado_sueldo || "pendiente",
        fecha_pago_sueldo: estadoInfo?.fecha_pago_sueldo || null,

        monto_autopista,
        estado_autopista: estadoInfo?.estado_autopista || "pendiente",
        fecha_pago_autopista: estadoInfo?.fecha_pago_autopista || null,

        monto_seguro,
        estado_seguro: estadoInfo?.estado_seguro || "pendiente",
        fecha_pago_seguro: estadoInfo?.fecha_pago_seguro || null,
      };
    });

    return resultados;
  },

  async updateEstadoPago(
    liquidacion_id: string,
    pendiente_id: string | null,
    parametro: "sueldo" | "autopista" | "seguro",
    nuevoEstado: EstadoPago
  ): Promise<void> {
    const columnaEstado = `estado_${parametro}`;
    const columnaFecha = `fecha_pago_${parametro}`;
    const fecha = nuevoEstado === "pagado" ? new Date().toISOString() : null;

    if (pendiente_id) {
      // Actualizar registro existente
      const { error } = await supabase
        .from("pendientes_pago")
        .update({
          [columnaEstado]: nuevoEstado,
          [columnaFecha]: fecha,
        })
        .eq("id", pendiente_id);

      if (error) throw error;
    } else {
      // Crear nuevo registro si no existía para esa liquidación
      const payload: any = {
        liquidacion_id,
        estado_sueldo: "pendiente",
        estado_autopista: "pendiente",
        estado_seguro: "pendiente",
        [columnaEstado]: nuevoEstado,
        [columnaFecha]: fecha,
      };

      const { error } = await supabase
        .from("pendientes_pago")
        .insert(payload);

      if (error) throw error;
    }
  },
  
  async marcarTodoComoPagado(liquidacion_id: string, pendiente_id: string | null): Promise<void> {
    const fecha = new Date().toISOString();
    
    if (pendiente_id) {
      const { error } = await supabase
        .from("pendientes_pago")
        .update({
          estado_sueldo: "pagado",
          fecha_pago_sueldo: fecha,
          estado_autopista: "pagado",
          fecha_pago_autopista: fecha,
          estado_seguro: "pagado",
          fecha_pago_seguro: fecha,
        })
        .eq("id", pendiente_id);

      if (error) throw error;
    } else {
      const payload: any = {
        liquidacion_id,
        estado_sueldo: "pagado",
        fecha_pago_sueldo: fecha,
        estado_autopista: "pagado",
        fecha_pago_autopista: fecha,
        estado_seguro: "pagado",
        fecha_pago_seguro: fecha,
      };

      const { error } = await supabase
        .from("pendientes_pago")
        .insert(payload);

      if (error) throw error;
    }
  }
};

