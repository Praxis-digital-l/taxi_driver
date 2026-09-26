-- Permitir campos vacíos / opcionales en profiles y vehicles para Carga Masiva
ALTER TABLE public.profiles
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN nombres DROP NOT NULL,
  ALTER COLUMN apellido_paterno DROP NOT NULL,
  ALTER COLUMN apellido_materno DROP NOT NULL,
  ALTER COLUMN full_name DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN rut DROP NOT NULL;
-- Convertir strings vacíos en rut y phone a NULL para evitar colisión con UNIQUE constraints
UPDATE public.profiles SET rut = NULL WHERE btrim(rut) = '';
UPDATE public.profiles SET phone = NULL WHERE btrim(phone) = '';
-- Permitir que los administradores inserten perfiles de conductores directamente en Carga Masiva
DROP POLICY IF EXISTS admins_can_insert_profiles ON public.profiles;
CREATE POLICY admins_can_insert_profiles
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
-- Permitir campos opcionales vacíos en vehicles
ALTER TABLE public.vehicles
  ALTER COLUMN make DROP NOT NULL,
  ALTER COLUMN model DROP NOT NULL,
  ALTER COLUMN year DROP NOT NULL,
  ALTER COLUMN color DROP NOT NULL;
