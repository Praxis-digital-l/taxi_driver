-- 1. Limpiar cualquier trigger duplicado o mal configurado en auth.users y public.profiles
DO $$
DECLARE
  _tg RECORD;
BEGIN
  FOR _tg IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users;', _tg.tgname);
  END LOOP;

  FOR _tg IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles;', _tg.tgname);
  END LOOP;
END $$;

-- 2. Función segura para handle_new_user (solo en INSERT y con ON CONFLICT DO NOTHING)
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

  -- Si existe un perfil creado previamente por carga masiva sin user_id, vincularlo
  IF _rut IS NOT NULL THEN
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE rut = _rut AND (user_id IS NULL OR user_id = NEW.id)
    LIMIT 1;
  END IF;

  IF existing_profile_id IS NULL AND _email IS NOT NULL THEN
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = _email AND (user_id IS NULL OR user_id = NEW.id)
    LIMIT 1;
  END IF;

  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id = NEW.id,
        email = COALESCE(_email, email),
        updated_at = now()
    WHERE id = existing_profile_id;
    RETURN NEW;
  END IF;

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
    'conductor'::public.app_role
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Recrear únicamente los triggers limpios en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_user_email_changed();

-- 4. Recrear los triggers limpios en public.profiles
CREATE TRIGGER sync_full_name_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_full_name();

CREATE TRIGGER ensure_profile_integrity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_integrity();
