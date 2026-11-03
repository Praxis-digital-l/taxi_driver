-- Migración para permitir cuentas duales (Admin y Conductor con el mismo RUT/teléfono)
-- y soportar la asignación correcta del rol en Carga Masiva.

-- 1. Actualizar restricciones UNIQUE en public.profiles:
--    Permitir que un mismo RUT o teléfono tenga una cuenta de conductor y una de admin,
--    pero evitando duplicados dentro del mismo rol.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rut_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- Eliminar posibles índices previos
DROP INDEX IF EXISTS public.profiles_rut_role_key;
DROP INDEX IF EXISTS public.profiles_phone_role_key;
DROP INDEX IF EXISTS public.profiles_rut_key;
DROP INDEX IF EXISTS public.profiles_phone_key;

-- Crear restricciones UNIQUE compuestas por (rut, role) y (phone, role)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rut_role_key UNIQUE (rut, role);

-- Para el teléfono, solo aplicar unicidad cuando no sea nulo ni vacío
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_role_idx
  ON public.profiles (phone, role)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

-- 2. Actualizar función handle_new_user() para respetar el rol indicado en los metadatos de Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_worker_id VARCHAR;
  existing_profile_id UUID;
  _rut TEXT;
  _email TEXT;
  _role public.app_role;
  _raw_role TEXT;
BEGIN
  -- Nunca ejecutar lógica de inserción en un UPDATE
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Si ya existe un perfil con este user_id, no volver a insertar
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _rut := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'rut', '')), '');
  _email := NULLIF(LOWER(TRIM(COALESCE(NEW.email, ''))), '');
  _raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'role', 'conductor')));

  IF _raw_role IN ('admin', 'super_admin') THEN
    _role := _raw_role::public.app_role;
  ELSE
    _role := 'conductor'::public.app_role;
  END IF;

  -- Prioridad 1: Vincular por email exacto (si existe un perfil creado sin user_id)
  IF _email IS NOT NULL THEN
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = _email AND (user_id IS NULL OR user_id = NEW.id)
    LIMIT 1;
  END IF;

  -- Prioridad 2: Vincular por RUT Y MISMO ROL (solo si user_id es NULL)
  IF existing_profile_id IS NULL AND _rut IS NOT NULL THEN
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE rut = _rut AND role = _role AND (user_id IS NULL OR user_id = NEW.id)
    LIMIT 1;
  END IF;

  -- Si existe perfil previo para vincular
  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id = NEW.id,
        email = COALESCE(_email, email),
        role = _role,
        updated_at = now()
    WHERE id = existing_profile_id;
    RETURN NEW;
  END IF;

  -- Generar worker_id si no viene en los metadatos
  new_worker_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'worker_id', '')), '');

  IF new_worker_id IS NULL THEN
    SELECT 'TR-' || LPAD((COALESCE(MAX((regexp_matches(worker_id, 'TR-(\d+)'))[1]::int), 0) + 1)::text, 6, '0')
    INTO new_worker_id
    FROM public.profiles
    WHERE worker_id ~ '^TR-\d+$';
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
    COALESCE(_email, ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    _rut,
    new_worker_id,
    _role
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

