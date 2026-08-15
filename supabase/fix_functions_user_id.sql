-- ============================================================
-- Fix: usar user_id (auth uid) en lugar de id en las funciones
-- del Conductor del Mes / foto de perfil.
-- Idempotente: puede ejecutarse varias veces sin errores.
-- ============================================================

-- 1. Validación de admin: el auth uid vive en profiles.user_id
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

-- 2. Foto de perfil: actualizar la fila del usuario autenticado
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
