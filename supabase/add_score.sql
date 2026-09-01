-- ============================================================
-- Puntuación de conductores (escala 1-10)
-- Idempotente: puede ejecutarse varias veces sin errores.
-- ============================================================

-- 1. Columna score en profiles (nullable; por defecto sin puntuación)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS score SMALLINT;

-- 2. Restricción de rango 1-10 (evita re-crearla si ya existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_score_range' AND conrelid = 'public.profiles'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_score_range CHECK (score IS NULL OR score BETWEEN 1 AND 10)';
  END IF;
END;
$$;