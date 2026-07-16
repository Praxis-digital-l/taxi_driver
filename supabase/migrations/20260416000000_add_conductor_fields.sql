-- Add new columns to profiles for driver management
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nombres TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apellido_paterno TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apellido_materno TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rut TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado_conductor TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (estado_conductor IN ('nuevo', 'antiguo', 'desactivado'));

-- Backfill nombres/apellidos from existing full_name
UPDATE public.profiles
SET
  nombres = CASE
    WHEN full_name != '' AND full_name IS NOT NULL
    THEN SPLIT_PART(full_name, ' ', 1)
    ELSE ''
  END,
  apellido_paterno = CASE
    WHEN full_name != '' AND full_name IS NOT NULL
    THEN SPLIT_PART(full_name, ' ', 2)
    ELSE ''
  END,
  apellido_materno = CASE
    WHEN full_name != '' AND full_name IS NOT NULL
    THEN SPLIT_PART(full_name, ' ', 3)
    ELSE ''
  END
WHERE nombres = '' AND full_name != '';

-- Trigger: sync full_name from nombres + apellidos
CREATE OR REPLACE FUNCTION public.sync_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.full_name := TRIM(
    COALESCE(NEW.nombres, '') || ' ' ||
    COALESCE(NEW.apellido_paterno, '') || ' ' ||
    COALESCE(NEW.apellido_materno, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_full_name_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_full_name();

-- Update existing profiles to have correct full_name
UPDATE public.profiles
SET full_name = TRIM(
  COALESCE(nombres, '') || ' ' ||
  COALESCE(apellido_paterno, '') || ' ' ||
  COALESCE(apellido_materno, '')
);

-- Only allow admins to update estado_conductor
CREATE OR REPLACE FUNCTION public.guard_estado_conductor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estado_conductor IS DISTINCT FROM OLD.estado_conductor THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can change conductor status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_estado_conductor_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_estado_conductor();
