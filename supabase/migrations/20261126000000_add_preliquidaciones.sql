-- ============================================================================
-- PRELIQUIDACIONES (BORRADORES DE NÓMINA)
-- Copiar y pegar en: https://supabase.com/dashboard/project/ywcgtwlhievzgflmncsq/sql
-- ============================================================================

-- Los borradores se identifican con firma_estado = 'preliquidacion'.
-- No se envían al conductor ni se incluyen en finanzas/rendimiento.
ALTER TABLE public.liquidaciones
  ADD COLUMN IF NOT EXISTS datos_nomina JSONB;

CREATE INDEX IF NOT EXISTS idx_liquidaciones_datos_nomina_preliquidacion
  ON public.liquidaciones(firma_estado, created_at DESC)
  WHERE firma_estado = 'preliquidacion';

COMMENT ON COLUMN public.liquidaciones.datos_nomina IS
  'Datos crudos del formulario de nómina para reanudar una preliquidación.';

COMMENT ON COLUMN public.liquidaciones.firma_estado IS
  'Estado del flujo: preliquidacion, sin_iniciar, pendiente, firmada, rechazada';
