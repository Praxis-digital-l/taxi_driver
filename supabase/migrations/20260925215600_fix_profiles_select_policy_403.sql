-- Corregir error 403 Forbidden en public.profiles eliminando el subselect directo a auth.users en la política RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);
