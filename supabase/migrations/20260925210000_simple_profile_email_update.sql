-- Permitir que el correo en public.profiles se edite libremente sin sobrescribirlo ni causar recursión con auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

CREATE OR REPLACE FUNCTION public.ensure_profile_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id AND OLD.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profile ownership cannot be changed';
  END IF;

  IF COALESCE(TRIM(NEW.email), '') <> '' THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;

  RETURN NEW;
END;
$$;
