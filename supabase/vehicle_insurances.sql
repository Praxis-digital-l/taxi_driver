-- ============================================================
-- Seguros de vehículos
-- Idempotente: puede ejecutarse varias veces sin errores.
-- ============================================================

-- 1. Tabla vehicle_insurances (una póliza activa por vehículo)
CREATE TABLE IF NOT EXISTS public.vehicle_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurance_type text NOT NULL CHECK (insurance_type IN ('obligatorio', 'comercial', 'asiento', 'otro')),
  amount numeric NOT NULL DEFAULT 0,
  expiration_date date NOT NULL,
  payment_status text NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'pagado')),
  last_payment_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para búsquedas por vencimiento
CREATE INDEX IF NOT EXISTS idx_vehicle_insurances_expiration_date
  ON public.vehicle_insurances (expiration_date);

-- Trigger para mantener updated_at al día
CREATE OR REPLACE FUNCTION public.set_insurance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_insurances_set_updated_at ON public.vehicle_insurances;
CREATE TRIGGER vehicle_insurances_set_updated_at
  BEFORE UPDATE ON public.vehicle_insurances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_insurance_updated_at();

-- 2. RLS: lectura para autenticados, escritura solo para admins
ALTER TABLE public.vehicle_insurances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_insurances_select ON public.vehicle_insurances;
CREATE POLICY vehicle_insurances_select
  ON public.vehicle_insurances
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS vehicle_insurances_insert ON public.vehicle_insurances;
CREATE POLICY vehicle_insurances_insert
  ON public.vehicle_insurances
  FOR INSERT
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS vehicle_insurances_update ON public.vehicle_insurances;
CREATE POLICY vehicle_insurances_update
  ON public.vehicle_insurances
  FOR UPDATE
  USING (public.is_app_admin());

DROP POLICY IF EXISTS vehicle_insurances_delete ON public.vehicle_insurances;
CREATE POLICY vehicle_insurances_delete
  ON public.vehicle_insurances
  FOR DELETE
  USING (public.is_app_admin());