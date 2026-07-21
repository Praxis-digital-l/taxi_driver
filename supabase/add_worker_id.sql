-- Agregar columna worker_id a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS worker_id VARCHAR;

-- Backfill: asignar IDs secuenciales a TODOS los perfiles existentes
-- Conductores → TR-XXXXXX, Administradores → ADM-XXXXXX
WITH numbered AS (
  SELECT
    id,
    CASE
      WHEN role = 'conductor' THEN 'TR-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0')
      ELSE 'ADM-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0')
    END AS new_id
  FROM public.profiles
)
UPDATE public.profiles p
SET worker_id = n.new_id
FROM numbered n
WHERE p.id = n.id;

-- Hacer NOT NULL y agregar constraint UNIQUE
ALTER TABLE public.profiles
  ALTER COLUMN worker_id SET NOT NULL,
  ADD CONSTRAINT profiles_worker_id_key UNIQUE (worker_id);

-- Índice para búsquedas por worker_id
CREATE INDEX IF NOT EXISTS idx_profiles_worker_id ON public.profiles (worker_id);

-- Actualizar trigger handle_new_user para incluir worker_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
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
    COALESCE(NEW.raw_user_meta_data ->> 'worker_id', ''),
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
