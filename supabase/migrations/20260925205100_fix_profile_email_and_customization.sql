-- 1. Asegurar que sync_full_name respete un full_name personalizado o lo construya desde nombres/apellidos
CREATE OR REPLACE FUNCTION public.sync_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _computed TEXT;
BEGIN
  _computed := TRIM(
    COALESCE(NEW.nombres, '') || ' ' ||
    COALESCE(NEW.apellido_paterno, '') || ' ' ||
    COALESCE(NEW.apellido_materno, '')
  );

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(TRIM(NEW.full_name), '') = '' THEN
      NEW.full_name := _computed;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name AND COALESCE(TRIM(NEW.full_name), '') <> '' THEN
      NEW.full_name := TRIM(NEW.full_name);
    ELSIF _computed <> '' THEN
      NEW.full_name := _computed;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Permitir actualizar el correo en public.profiles y sincronizarlo automáticamente con auth.users
CREATE OR REPLACE FUNCTION public.ensure_profile_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auth_email TEXT;
  _new_email TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id AND OLD.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profile ownership cannot be changed';
  END IF;

  _new_email := LOWER(TRIM(COALESCE(NEW.email, '')));

  IF TG_OP = 'UPDATE' AND _new_email <> '' AND _new_email IS DISTINCT FROM LOWER(TRIM(COALESCE(OLD.email, ''))) THEN
    NEW.email := _new_email;

    -- Sincronizar también en auth.users e identities si el perfil está vinculado a una cuenta Auth
    IF NEW.user_id IS NOT NULL THEN
      UPDATE auth.users
      SET email = _new_email,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', _new_email),
          updated_at = now()
      WHERE id = NEW.user_id
        AND LOWER(TRIM(COALESCE(email, ''))) IS DISTINCT FROM _new_email;

      UPDATE auth.identities
      SET identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', _new_email),
          updated_at = now()
      WHERE user_id = NEW.user_id
        AND provider = 'email';
    END IF;
  ELSE
    IF NEW.user_id IS NOT NULL THEN
      SELECT LOWER(TRIM(COALESCE(email, ''))) INTO _auth_email
      FROM auth.users
      WHERE id = NEW.user_id;
    END IF;

    NEW.email := COALESCE(NULLIF(_auth_email, ''), _new_email, '');
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Evitar recursión en el trigger de auth.users cuando se sincroniza el correo
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized TEXT;
BEGIN
  _normalized := LOWER(TRIM(COALESCE(NEW.email, '')));

  UPDATE public.profiles
  SET email = _normalized,
      updated_at = now()
  WHERE user_id = NEW.id
    AND LOWER(TRIM(COALESCE(email, ''))) IS DISTINCT FROM _normalized;

  RETURN NEW;
END;
$$;
