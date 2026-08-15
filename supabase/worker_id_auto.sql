-- ============================================================
-- Auto-asignar worker_id a conductores
-- 1) Rellenar los conductores existentes que quedaron sin ID
-- 2) El trigger handle_new_user genera el ID si viene vacío
-- Idempotente: puede ejecutarse varias veces sin errores.
-- ============================================================

-- 1. Backfill: asignar el siguiente ID TR-XXXXXX a conductores sin worker_id
DO $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX((regexp_matches(worker_id, 'TR-(\d+)'))[1]::int), 0) INTO next_num
  FROM public.profiles
  WHERE worker_id ~ '^TR-\d+$';

  UPDATE public.profiles p
  SET worker_id = 'TR-' || LPAD((next_num + rn)::text, 6, '0')
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM public.profiles
    WHERE role = 'conductor' AND (worker_id IS NULL OR worker_id = '')
  ) sub
  WHERE p.id = sub.id;
END $$;

-- 2. Trigger: generar worker_id automáticamente cuando llega vacío
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  new_worker_id VARCHAR;
BEGIN
  new_worker_id := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'worker_id'), '');

  IF new_worker_id IS NULL THEN
    SELECT 'TR-' || LPAD((COALESCE(MAX((regexp_matches(worker_id, 'TR-(\d+)'))[1]::int), 0) + 1)::text, 6, '0')
    INTO new_worker_id
    FROM public.profiles
    WHERE role = 'conductor' AND worker_id ~ '^TR-\d+$';
  END IF;

  INSERT INTO public.profiles (
    user_id,
    full_name,
    nombres,
    apellido_paterno,
    apellido_materno,
    email,
    phone,
    rut,
    worker_id,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'nombres', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellido_paterno', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellido_materno', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'rut', ''),
    new_worker_id,
    'conductor'::app_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
