-- ============================================================
-- Conductor del Mes + foto de perfil
-- Idempotente: puede ejecutarse varias veces sin errores.
-- ============================================================

-- 1. Columna de foto de perfil en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Tabla conductor_del_mes (un conductor por mes/año)
CREATE TABLE IF NOT EXISTS public.conductor_del_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  selected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conductor_del_mes_period UNIQUE (month, year)
);

-- 3. RLS: lectura para autenticados, escritura solo para admins
-- Helper SECURITY DEFINER para validar admin sin que RLS de profiles interfiera
-- (mismo patrón que set_profile_photo_url / mark_message_read)
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

ALTER TABLE public.conductor_del_mes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conductor_del_mes_select ON public.conductor_del_mes;
CREATE POLICY conductor_del_mes_select
  ON public.conductor_del_mes
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS conductor_del_mes_insert ON public.conductor_del_mes;
CREATE POLICY conductor_del_mes_insert
  ON public.conductor_del_mes
  FOR INSERT
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS conductor_del_mes_update ON public.conductor_del_mes;
CREATE POLICY conductor_del_mes_update
  ON public.conductor_del_mes
  FOR UPDATE
  USING (public.is_app_admin());

DROP POLICY IF EXISTS conductor_del_mes_delete ON public.conductor_del_mes;
CREATE POLICY conductor_del_mes_delete
  ON public.conductor_del_mes
  FOR DELETE
  USING (public.is_app_admin());

-- 4. Función que permite al conductor actualizar SU propia foto
--    (bypass RLS con SECURITY DEFINER, patrón mark_message_read)
CREATE OR REPLACE FUNCTION public.set_profile_photo_url(new_photo_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET photo_url = new_photo_url,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_photo_url TO authenticated;

-- 5. Bucket público Avatares + políticas de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('Avatares', 'Avatares', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatares_read ON storage.objects;
CREATE POLICY avatares_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'Avatares');

DROP POLICY IF EXISTS avatares_own_insert ON storage.objects;
CREATE POLICY avatares_own_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'Avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatares_own_update ON storage.objects;
CREATE POLICY avatares_own_update
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'Avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatares_own_delete ON storage.objects;
CREATE POLICY avatares_own_delete
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'Avatares' AND (storage.foldername(name))[1] = auth.uid()::text);