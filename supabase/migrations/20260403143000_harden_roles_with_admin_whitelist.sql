CREATE TABLE public.admin_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_whitelist_email_normalized CHECK (email = lower(btrim(email)))
);

ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_whitelist FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_email(_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(COALESCE(_email, '')));
$$;

CREATE OR REPLACE FUNCTION public.enforce_admin_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _current_count INTEGER;
BEGIN
  NEW.email := public.normalize_email(NEW.email);
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO _current_count
    FROM public.admin_whitelist;

    IF _current_count >= 3 THEN
      RAISE EXCEPTION 'Only 3 administrators can be configured';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_admin_whitelist
  BEFORE INSERT OR UPDATE ON public.admin_whitelist
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_whitelist();

CREATE TRIGGER update_admin_whitelist_updated_at
  BEFORE UPDATE ON public.admin_whitelist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_whitelist (email, label)
VALUES
  ('gerencia@santaaurora.cl', 'Gerencia'),
  ('operaciones@santaaurora.cl', 'Operaciones'),
  ('flota@santaaurora.cl', 'Administracion de flota')
ON CONFLICT (email) DO UPDATE
SET label = EXCLUDED.label;

CREATE OR REPLACE FUNCTION public.get_auth_user_email(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_email(email)
  FROM auth.users
  WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_admin_whitelist_user(_user_id UUID, _email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized_email TEXT := public.normalize_email(_email);
BEGIN
  IF _normalized_email = '' THEN
    RETURN;
  END IF;

  UPDATE public.admin_whitelist
  SET user_id = _user_id,
      updated_at = now()
  WHERE user_id IS NULL
    AND email = _normalized_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
BEGIN
  _email := public.get_auth_user_email(_user_id);

  IF EXISTS (
    SELECT 1
    FROM public.admin_whitelist aw
    WHERE aw.user_id = _user_id
      OR (aw.user_id IS NULL AND aw.email = _email)
  ) THEN
    RETURN 'admin';
  END IF;

  RETURN 'conductor';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.resolve_user_role(_user_id) = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_conductor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.resolve_user_role(_user_id) = 'conductor';
$$;

CREATE OR REPLACE FUNCTION public.can_access_profile(_profile_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _profile_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auth_email TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Profile ownership cannot be changed';
  END IF;

  _auth_email := public.get_auth_user_email(NEW.user_id);
  PERFORM public.sync_admin_whitelist_user(NEW.user_id, _auth_email);

  NEW.email := COALESCE(_auth_email, public.normalize_email(NEW.email), '');
  NEW.role := public.resolve_user_role(NEW.user_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_profile_integrity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_integrity();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_admin_whitelist_user(NEW.id, NEW.email);

  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(public.normalize_email(NEW.email), ''),
    public.resolve_user_role(NEW.id)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = EXCLUDED.email,
    role = public.resolve_user_role(NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_admin_whitelist_user(NEW.id, NEW.email);

  UPDATE public.profiles
  SET email = COALESCE(public.normalize_email(NEW.email), ''),
      role = public.resolve_user_role(NEW.id)
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_user_email_changed();

UPDATE public.admin_whitelist aw
SET user_id = u.id,
    updated_at = now()
FROM auth.users u
WHERE aw.user_id IS NULL
  AND aw.email = public.normalize_email(u.email);

UPDATE public.profiles
SET email = COALESCE(public.get_auth_user_email(user_id), email),
    role = public.resolve_user_role(user_id),
    updated_at = now();

ALTER POLICY "Users can update own profile"
ON public.profiles
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Conductors insert documents" ON public.documents;
DROP POLICY IF EXISTS "Manage own documents" ON public.documents;

CREATE POLICY "Conductors insert documents" ON public.documents
FOR INSERT
WITH CHECK (
  public.can_access_profile(profile_id, auth.uid())
  AND (vehicle_id IS NULL OR public.has_vehicle_access(vehicle_id, auth.uid()))
);

CREATE POLICY "Admins update documents" ON public.documents
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Insert mileage" ON public.mileage_records;
DROP POLICY IF EXISTS "Update mileage" ON public.mileage_records;

CREATE POLICY "Insert mileage" ON public.mileage_records
FOR INSERT
WITH CHECK (
  public.can_access_profile(profile_id, auth.uid())
  AND public.has_vehicle_access(vehicle_id, auth.uid())
);

CREATE POLICY "Admins update mileage" ON public.mileage_records
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Conductors create requests" ON public.requests;
DROP POLICY IF EXISTS "Manage requests" ON public.requests;
DROP POLICY IF EXISTS "Delete requests" ON public.requests;

CREATE POLICY "Conductors create requests" ON public.requests
FOR INSERT
WITH CHECK (
  public.can_access_profile(profile_id, auth.uid())
  AND (vehicle_id IS NULL OR public.has_vehicle_access(vehicle_id, auth.uid()))
  AND status = 'pendiente'
);

CREATE POLICY "Admins update requests" ON public.requests
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete requests" ON public.requests
FOR DELETE
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Send messages" ON public.messages;
DROP POLICY IF EXISTS "Update own messages" ON public.messages;

CREATE POLICY "Admins send messages" ON public.messages
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid())
  AND sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins and receivers update messages" ON public.messages
FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.guard_message_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _receiver_profile_id UUID;
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _receiver_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF _receiver_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile not found';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only administrators can send messages';
  END IF;

  IF OLD.receiver_id <> _receiver_profile_id OR NEW.receiver_id <> _receiver_profile_id THEN
    RAISE EXCEPTION 'You can only update messages sent to your own profile';
  END IF;

  IF NEW.sender_id <> OLD.sender_id
    OR NEW.receiver_id <> OLD.receiver_id
    OR NEW.content <> OLD.content
    OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Drivers can only update message status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_message_updates
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_message_updates();
