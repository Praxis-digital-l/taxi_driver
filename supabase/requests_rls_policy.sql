-- ============================================================
-- Políticas RLS para la tabla public.requests
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
--
-- Arregla: "no deja guardar los cambios del edit" y "no deja borrar
-- las solicitudes". Las tablas con RLS habilitado y SIN política
-- para una operación (UPDATE/DELETE) devuelven 0 filas SIN error,
-- por eso antes parecía "guardado" pero no cambiaba nada.
-- ============================================================

-- 1. Habilitar RLS si no lo está (idempotente)
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- 2. Lectura: el conductor ve sus propias solicitudes; admin/super_admin ve todas
DROP POLICY IF EXISTS "requests_select" ON public.requests;
CREATE POLICY "requests_select"
  ON public.requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = requests.profile_id
        AND profiles.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 3. Inserción: el conductor solo puede crear solicitudes a su nombre
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert"
  ON public.requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
        AND profiles.user_id = auth.uid()
    )
  );

-- 4. Actualización: el conductor edita sus propias solicitudes; admin/super_admin edita todas
DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update"
  ON public.requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = requests.profile_id
        AND profiles.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 5. Eliminación: el conductor borra sus propias solicitudes; admin/super_admin borra todas
DROP POLICY IF EXISTS "requests_delete" ON public.requests;
CREATE POLICY "requests_delete"
  ON public.requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = requests.profile_id
        AND profiles.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );