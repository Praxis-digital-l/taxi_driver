-- Permitir que cada usuario autenticado pueda actualizar su propio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Asegurar que los administradores puedan actualizar cualquier perfil (incluso los creados por carga masiva sin user_id)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Permitir que los administradores también puedan subir avatares de cualquier conductor en el bucket Avatares
DROP POLICY IF EXISTS "Admins can manage all avatars" ON storage.objects;
CREATE POLICY "Admins can manage all avatars"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'Avatares' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'Avatares' AND public.is_admin(auth.uid()));

