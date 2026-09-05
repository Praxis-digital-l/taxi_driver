-- ============================================================
-- Vacaciones de conductores y postergación de arriendo con recargo 10%
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- ============================================================

-- 1. Crear tabla conductor_vacations
CREATE TABLE IF NOT EXISTS public.conductor_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL,
  surcharge_percentage numeric NOT NULL DEFAULT 10,
  rent_postponed boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'programada' CHECK (status IN ('programada', 'en_curso', 'finalizada', 'cancelada')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_conductor_vacations_profile_id
  ON public.conductor_vacations (profile_id);

CREATE INDEX IF NOT EXISTS idx_conductor_vacations_dates
  ON public.conductor_vacations (start_date, end_date);

-- 3. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.set_conductor_vacation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conductor_vacations_set_updated_at ON public.conductor_vacations;
CREATE TRIGGER conductor_vacations_set_updated_at
  BEFORE UPDATE ON public.conductor_vacations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conductor_vacation_updated_at();

-- 4. Habilitar Seguridad RLS
ALTER TABLE public.conductor_vacations ENABLE ROW LEVEL SECURITY;

-- Lectura: Cualquier usuario autenticado
DROP POLICY IF EXISTS conductor_vacations_select ON public.conductor_vacations;
CREATE POLICY conductor_vacations_select
  ON public.conductor_vacations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Inserción: Cualquier usuario autenticado
DROP POLICY IF EXISTS conductor_vacations_insert ON public.conductor_vacations;
CREATE POLICY conductor_vacations_insert
  ON public.conductor_vacations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Actualización: Cualquier usuario autenticado
DROP POLICY IF EXISTS conductor_vacations_update ON public.conductor_vacations;
CREATE POLICY conductor_vacations_update
  ON public.conductor_vacations
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Eliminación: Cualquier usuario autenticado
DROP POLICY IF EXISTS conductor_vacations_delete ON public.conductor_vacations;
CREATE POLICY conductor_vacations_delete
  ON public.conductor_vacations
  FOR DELETE
  USING (auth.role() = 'authenticated');

