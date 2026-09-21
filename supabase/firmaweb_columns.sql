-- ============================================================================
-- MIGRACIÓN PARA INTEGRACIÓN CON FIRMAWEB
-- Copiar y pegar en: https://supabase.com/dashboard/project/ywcgtwlhievzgflmncsq/sql
-- ============================================================================

-- 1. Agregar columnas de seguimiento de FirmaWeb a la tabla 'liquidaciones'
ALTER TABLE public.liquidaciones 
  ADD COLUMN IF NOT EXISTS firma_id_proceso BIGINT,
  ADD COLUMN IF NOT EXISTS firma_id_documento BIGINT,
  ADD COLUMN IF NOT EXISTS firma_estado TEXT DEFAULT 'sin_iniciar',
  ADD COLUMN IF NOT EXISTS firma_url_empleado TEXT,
  ADD COLUMN IF NOT EXISTS firma_url_empleador TEXT,
  ADD COLUMN IF NOT EXISTS firma_iniciada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS firma_completada_at TIMESTAMPTZ;

-- 2. Índices para consultas rápidas y para el receptor de Webhook
CREATE INDEX IF NOT EXISTS idx_liquidaciones_firma_id_proceso 
  ON public.liquidaciones(firma_id_proceso);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_firma_id_documento 
  ON public.liquidaciones(firma_id_documento);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_firma_estado 
  ON public.liquidaciones(firma_estado);

-- 3. Comentarios descriptivos de las columnas
COMMENT ON COLUMN public.liquidaciones.firma_id_proceso IS 'ID del proceso devuelto por FirmaWeb (/crear_proceso)';
COMMENT ON COLUMN public.liquidaciones.firma_id_documento IS 'ID del documento devuelto por FirmaWeb (/agregar_documento)';
COMMENT ON COLUMN public.liquidaciones.firma_estado IS 'Estado del flujo: sin_iniciar, pendiente, firmada, rechazada';
COMMENT ON COLUMN public.liquidaciones.firma_url_empleado IS 'Enlace de firma electrónica para el conductor';
COMMENT ON COLUMN public.liquidaciones.firma_url_empleador IS 'Enlace de firma electrónica para el empleador';

