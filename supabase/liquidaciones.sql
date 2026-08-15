-- ============================================================
-- Liquidaciones de nómina enviadas a conductores
-- Idempotente: puede ejecutarse varias veces sin errores.
-- ============================================================

-- 1. Tabla liquidaciones
CREATE TABLE IF NOT EXISTS public.liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  nombre text NOT NULL,
  email text,
  rut text,
  total_facturado numeric NOT NULL DEFAULT 0,
  descuentos_primarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  descuentos_secundarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_descuentos numeric NOT NULL DEFAULT 0,
  total_a_pagar numeric NOT NULL DEFAULT 0,
  mes text NOT NULL,
  fecha text NOT NULL,
  file_url text,
  enviado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_profile_id ON public.liquidaciones (profile_id);

-- 2. RLS: admins ven y envían todo, cada conductor solo sus propias liquidaciones
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;

-- Helper SECURITY DEFINER para validar admin (mismo patrón que is_app_admin)
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

DROP POLICY IF EXISTS liquidaciones_select ON public.liquidaciones;
CREATE POLICY liquidaciones_select
  ON public.liquidaciones
  FOR SELECT
  USING (
    public.is_app_admin()
    OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS liquidaciones_insert ON public.liquidaciones;
CREATE POLICY liquidaciones_insert
  ON public.liquidaciones
  FOR INSERT
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS liquidaciones_update ON public.liquidaciones;
CREATE POLICY liquidaciones_update
  ON public.liquidaciones
  FOR UPDATE
  USING (public.is_app_admin());

DROP POLICY IF EXISTS liquidaciones_delete ON public.liquidaciones;
CREATE POLICY liquidaciones_delete
  ON public.liquidaciones
  FOR DELETE
  USING (public.is_app_admin());

-- 3. Bucket de storage para los PDF de liquidaciones
INSERT INTO storage.buckets (id, name, public)
VALUES ('Liquidaciones', 'Liquidaciones', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS liquidaciones_storage_read ON storage.objects;
CREATE POLICY liquidaciones_storage_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'Liquidaciones');

DROP POLICY IF EXISTS liquidaciones_storage_insert ON storage.objects;
CREATE POLICY liquidaciones_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'Liquidaciones' AND public.is_app_admin());

DROP POLICY IF EXISTS liquidaciones_storage_update ON storage.objects;
CREATE POLICY liquidaciones_storage_update
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'Liquidaciones' AND public.is_app_admin());

DROP POLICY IF EXISTS liquidaciones_storage_delete ON storage.objects;
CREATE POLICY liquidaciones_storage_delete
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'Liquidaciones' AND public.is_app_admin());
