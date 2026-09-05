-- ============================================================
-- Observaciones e inspección técnica de vehículos (Vehicle Mechanics)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- ============================================================

-- 1. Crear tabla vehicle_observations
CREATE TABLE IF NOT EXISTS public.vehicle_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  part_key text NOT NULL,
  part_name text NOT NULL,
  condition text NOT NULL DEFAULT 'warning' CHECK (condition IN ('good', 'warning', 'damaged')),
  issue_type text NOT NULL DEFAULT 'otro' CHECK (issue_type IN ('rayon', 'abolladura', 'mecanico', 'desgaste', 'vidrio', 'limpieza', 'luces', 'neumatico', 'otro')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_revision', 'reparado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_vehicle_observations_vehicle_id
  ON public.vehicle_observations (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_observations_profile_id
  ON public.vehicle_observations (profile_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_observations_created_at
  ON public.vehicle_observations (created_at DESC);

-- 3. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_vehicle_observation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_observations_set_updated_at ON public.vehicle_observations;
CREATE TRIGGER vehicle_observations_set_updated_at
  BEFORE UPDATE ON public.vehicle_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vehicle_observation_updated_at();

-- 4. Habilitar Seguridad RLS (Row Level Security)
ALTER TABLE public.vehicle_observations ENABLE ROW LEVEL SECURITY;

-- Lectura: Cualquier usuario autenticado (administrador o conductor) puede leer
DROP POLICY IF EXISTS vehicle_observations_select ON public.vehicle_observations;
CREATE POLICY vehicle_observations_select
  ON public.vehicle_observations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Inserción: Cualquier usuario autenticado puede registrar observaciones
DROP POLICY IF EXISTS vehicle_observations_insert ON public.vehicle_observations;
CREATE POLICY vehicle_observations_insert
  ON public.vehicle_observations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Actualización: Cualquier usuario autenticado puede actualizar estados
DROP POLICY IF EXISTS vehicle_observations_update ON public.vehicle_observations;
CREATE POLICY vehicle_observations_update
  ON public.vehicle_observations
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Eliminación: Cualquier usuario autenticado puede eliminar
DROP POLICY IF EXISTS vehicle_observations_delete ON public.vehicle_observations;
CREATE POLICY vehicle_observations_delete
  ON public.vehicle_observations
  FOR DELETE
  USING (auth.role() = 'authenticated');

