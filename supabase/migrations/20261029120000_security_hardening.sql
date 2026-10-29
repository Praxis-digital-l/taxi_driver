-- ============================================================================
-- Hardening de seguridad — 2026-10-29
--
-- Corrige los avisos del Supabase Database Linter:
--   * 0025 public_bucket_allows_listing (Avatares, Documents, Liquidaciones)
--   * 0028 anon_security_definer_function_executable
--   * 0029 authenticated_security_definer_function_executable
--
-- Cómo está resuelto:
--   * Los buckets siguen siendo públicos (la app usa getPublicUrl), pero las
--     políticas SELECT ya no permiten listar todo el bucket: cada usuario sólo
--     puede leer su carpeta y los admin/super_admin pueden leer todo.
--   * Las funciones que sólo usan triggers ya no son ejecutables por
--     `anon`/`authenticated`.
--   * Las funciones privilegiadas (helpers de RLS y RPC de la app) se mueven
--     al schema `private`, que NO está expuesto por PostgREST. En `public`
--     queda un wrapper SECURITY INVOKER con la misma firma, de modo que:
--         - la app sigue llamando igual a supabase.rpc(...)
--         - las políticas RLS existentes siguen funcionando (referencian la
--           función por OID, el cambio de schema no las rompe)
--         - las funciones que llaman a estos helpers por texto siguen
--           resolviendo el nombre en `public`
--
-- Es IDEMPOTENTE: se puede volver a ejecutar sin efectos secundarios.
--
-- IMPORTANTE: si algún día vuelves a ejecutar los scripts antiguos
-- (supabase/conductor_del_mes.sql, fix_functions_user_id.sql,
-- messages_rls_policy.sql, etc.) vuelve a ejecutar ESTA migración después,
-- porque esos scripts recrean funciones/políticas en `public`.
--
-- El aviso auth_leaked_password_protection NO se puede corregir por SQL:
-- se activa en Dashboard > Authentication > Providers > Email o vía
-- Management API. Instrucciones en docs/security-hardening-2026-10-29.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema privado para lógica privilegiada
--    PostgREST sólo expone `public`, así que nada de aquí es invocable por API.
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Revocar EXECUTE de `anon` (y del grant implícito a PUBLIC) en TODAS las
--    funciones reportadas por el linter 0028.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'admin_create_conductor',
        'can_access_profile',
        'delete_auth_user',
        'enforce_loan_request_rules',
        'enforce_request_min_score',
        'ensure_profile_integrity',
        'get_conductor_del_mes',
        'guard_estado_conductor',
        'handle_auth_user_email_changed',
        'handle_new_user',
        'has_vehicle_access',
        'is_admin',
        'is_app_admin',
        'is_conductor',
        'mark_message_read',
        'resolve_user_role',
        'rls_auto_enable',
        'set_profile_photo_url',
        'sync_full_name',
        'update_own_profile'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Funciones que NO necesitan ser ejecutables por usuarios normales:
--      - funciones de trigger (se ejecutan como trigger, no por RPC)
--      - funciones administrativas legacy (los flujos actuales usan las
--        Edge Functions con service_role)
--      - rls_auto_enable (event trigger / DDL)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        -- administración legacy / DDL
        'admin_create_conductor',
        'delete_auth_user',
        'rls_auto_enable',
        -- triggers
        'enforce_loan_request_rules',
        'enforce_request_min_score',
        'ensure_profile_integrity',
        'guard_estado_conductor',
        'handle_auth_user_email_changed',
        'handle_new_user',
        'sync_full_name'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;', r.sig);
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 4. Las RPC que usa la app y los helpers de RLS sí deben poder ser
--    ejecutados por `authenticated` (el wrapper INVOKER lo requiere).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_conductor_del_mes',
        'mark_message_read',
        'set_profile_photo_url',
        'update_own_profile',
        'is_admin',
        'is_app_admin',
        'is_conductor',
        'can_access_profile',
        'has_vehicle_access',
        'resolve_user_role'
      ])
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.sig);
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 5. Mover la lógica privilegiada a `private` y dejar wrappers INVOKER en
--    `public` con la MISMA firma (los nombres de argumentos se conservan para
--    que supabase-js / PostgREST sigan enviando los parámetros con nombre).
-- ----------------------------------------------------------------------------

-- 5.1 set_profile_photo_url(text)
DO $$
BEGIN
  IF to_regprocedure('private.set_profile_photo_url(text)') IS NULL
     AND to_regprocedure('public.set_profile_photo_url(text)') IS NOT NULL THEN
    ALTER FUNCTION public.set_profile_photo_url(text) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_profile_photo_url(new_photo_url text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT private.set_profile_photo_url(new_photo_url);
$$;
REVOKE ALL ON FUNCTION public.set_profile_photo_url(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_photo_url(text) TO authenticated, service_role;

-- 5.2 update_own_profile(text, text, text, text, text)
DO $$
BEGIN
  IF to_regprocedure('private.update_own_profile(text,text,text,text,text)') IS NULL
     AND to_regprocedure('public.update_own_profile(text,text,text,text,text)') IS NOT NULL THEN
    ALTER FUNCTION public.update_own_profile(text, text, text, text, text) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_nombres text,
  p_apellido_paterno text,
  p_apellido_materno text,
  p_rut text,
  p_phone text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT private.update_own_profile(
    p_nombres,
    p_apellido_paterno,
    p_apellido_materno,
    p_rut,
    p_phone
  );
$$;
REVOKE ALL ON FUNCTION public.update_own_profile(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text, text, text, text) TO authenticated, service_role;

-- 5.3 get_conductor_del_mes(integer, integer)
DO $$
BEGIN
  IF to_regprocedure('private.get_conductor_del_mes(integer,integer)') IS NULL
     AND to_regprocedure('public.get_conductor_del_mes(integer,integer)') IS NOT NULL THEN
    ALTER FUNCTION public.get_conductor_del_mes(integer, integer) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_conductor_del_mes(
  p_month integer DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.get_conductor_del_mes(p_month, p_year);
$$;
REVOKE ALL ON FUNCTION public.get_conductor_del_mes(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conductor_del_mes(integer, integer) TO authenticated, service_role;

-- 5.4 mark_message_read(uuid)
--     Además de moverla a private, se endurece: sólo puede marcar como leído
--     un mensaje cuyo destinatario sea el usuario autenticado (antes cualquier
--     usuario autenticado podía marcar cualquier mensaje conociendo su id).
DO $$
BEGIN
  IF to_regprocedure('private.mark_message_read(uuid)') IS NULL
     AND to_regprocedure('public.mark_message_read(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.mark_message_read(uuid) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.mark_message_read(msg_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.messages
     SET status = 'visto',
         read_at = COALESCE(read_at, now())
   WHERE id = msg_id
     AND receiver_id = (
       SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_message_read(msg_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT private.mark_message_read(msg_id);
$$;
REVOKE ALL ON FUNCTION public.mark_message_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated, service_role;

-- 5.5 Helpers usados por políticas RLS.
--     Las políticas ya creadas referencian la función por OID, por lo que el
--     cambio de schema no las rompe. El wrapper en `public` se mantiene para
--     cualquier función/trigger que llame al helper por nombre.
DO $$
BEGIN
  IF to_regprocedure('private.is_admin(uuid)') IS NULL
     AND to_regprocedure('public.is_admin(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.is_admin(uuid) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.is_admin(_user_id);
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('private.is_app_admin()') IS NULL
     AND to_regprocedure('public.is_app_admin()') IS NOT NULL THEN
    ALTER FUNCTION public.is_app_admin() SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.is_app_admin();
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('private.is_conductor(uuid)') IS NULL
     AND to_regprocedure('public.is_conductor(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.is_conductor(uuid) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_conductor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.is_conductor(_user_id);
$$;
REVOKE ALL ON FUNCTION public.is_conductor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conductor(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('private.can_access_profile(uuid,uuid)') IS NULL
     AND to_regprocedure('public.can_access_profile(uuid,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.can_access_profile(uuid, uuid) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.can_access_profile(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.can_access_profile(_profile_id, _user_id);
$$;
REVOKE ALL ON FUNCTION public.can_access_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_profile(uuid, uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('private.has_vehicle_access(uuid,uuid)') IS NULL
     AND to_regprocedure('public.has_vehicle_access(uuid,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.has_vehicle_access(uuid, uuid) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.has_vehicle_access(_vehicle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.has_vehicle_access(_vehicle_id, _user_id);
$$;
REVOKE ALL ON FUNCTION public.has_vehicle_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_vehicle_access(uuid, uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('private.resolve_user_role(uuid)') IS NULL
     AND to_regprocedure('public.resolve_user_role(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.resolve_user_role(uuid) SET SCHEMA private;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.resolve_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = 'public'
AS $$
  SELECT private.resolve_user_role(_user_id);
$$;
REVOKE ALL ON FUNCTION public.resolve_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_user_role(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Permisos del schema private:
--    - `authenticated` los necesita para evaluar políticas RLS.
--    - `anon` los necesita sólo si alguna política se evalúa con anon; al no
--      estar `private` expuesto por PostgREST, no hay superficie de API.
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, anon, service_role;

-- service_role es un rol de servidor (Edge Functions); mantiene acceso a todo.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------------------
-- 7. Storage: reemplazar las políticas SELECT "broad" por políticas acotadas.
--    Los buckets siguen siendo públicos (getPublicUrl sigue funcionando); lo
--    que se elimina es la posibilidad de LISTAR todos los archivos.
--    Ojo: createSignedUrl / download() sí pasan por RLS, por eso se mantiene
--    lectura para el dueño y para admin/super_admin.
-- ----------------------------------------------------------------------------

-- 7.0 Eliminar CUALQUIER política SELECT/ALL amplia sobre estos buckets.
--     No nos fiamos de los nombres: las políticas de Documents y Liquidaciones
--     se crearon desde el Dashboard y pueden llamarse de cualquier forma. El
--     linter 0025 sólo marca políticas cuyo USING es exactamente
--     `bucket_id = '<bucket>'` o `true`, así que buscamos por expresión.
--     Si la política amplia es FOR ALL, se descompone en INSERT/UPDATE/DELETE
--     para no perder la capacidad de subir/borrar archivos.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT p.polname,
           p.polcmd,
           COALESCE(pg_get_expr(p.polqual, p.polrelid), 'true') AS qual_expr,
           COALESCE(pg_get_expr(p.polwithcheck, p.polrelid),
                    pg_get_expr(p.polqual, p.polrelid),
                    'true') AS check_expr,
           COALESCE((
             SELECT string_agg(
                      CASE WHEN r.roloid = 0 THEN 'PUBLIC'
                           ELSE quote_ident(rol.rolname) END,
                      ', ' ORDER BY r.roloid)
             FROM unnest(p.polroles) AS r(roloid)
             LEFT JOIN pg_roles rol ON rol.oid = r.roloid
           ), 'PUBLIC') AS roles
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND p.polcmd IN ('r', '*')
      AND (
        pg_get_expr(p.polqual, p.polrelid) IS NULL
        OR pg_get_expr(p.polqual, p.polrelid) ~*
           '^\s*\(*\s*(true|1\s*=\s*1)\s*\)*\s*$'
        OR pg_get_expr(p.polqual, p.polrelid) ~*
           '^\s*\(*\s*bucket_id\s*=\s*''(Avatares|Documents|Liquidaciones)''(\s*::\s*[[:alnum:]_.]+)?\s*\)*\s*$'
      )
  LOOP
    IF pol.polcmd = 'r' THEN
      BEGIN
        EXECUTE format('DROP POLICY %I ON storage.objects', pol.polname);
        RAISE NOTICE 'Política SELECT amplia eliminada: %', pol.polname;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'No se pudo eliminar la política %: %', pol.polname, SQLERRM;
      END;
    ELSE
      -- FOR ALL: se recrea como INSERT + UPDATE + DELETE con las mismas reglas.
      BEGIN
        EXECUTE format('DROP POLICY %I ON storage.objects', pol.polname);
        EXECUTE format(
          'CREATE POLICY %I ON storage.objects FOR INSERT TO %s WITH CHECK (%s)',
          pol.polname || '_insert', pol.roles, pol.check_expr);
        EXECUTE format(
          'CREATE POLICY %I ON storage.objects FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
          pol.polname || '_update', pol.roles, pol.qual_expr, pol.check_expr);
        EXECUTE format(
          'CREATE POLICY %I ON storage.objects FOR DELETE TO %s USING (%s)',
          pol.polname || '_delete', pol.roles, pol.qual_expr);
        RAISE NOTICE 'Política ALL amplia descompuesta: %', pol.polname;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'No se pudo descomponer la política %: %', pol.polname, SQLERRM;
      END;
    END IF;
  END LOOP;
END
$$;

-- 7.1 Avatares
DROP POLICY IF EXISTS avatares_read ON storage.objects;
DROP POLICY IF EXISTS avatares_select_owner_or_admin ON storage.objects;
CREATE POLICY avatares_select_owner_or_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'Avatares'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('admin', 'super_admin')
      )
    )
  );

-- 7.2 Documents
DROP POLICY IF EXISTS "Authenticated users can view Documents" ON storage.objects;
DROP POLICY IF EXISTS documents_select_owner_or_admin ON storage.objects;
CREATE POLICY documents_select_owner_or_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'Documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('admin', 'super_admin')
      )
    )
  );

-- 7.3 Liquidaciones
--     Las carpetas se nombran con profiles.id (no con el auth uid), y los PDF
--     los sube un administrador; el conductor debe poder descargar los suyos.
DROP POLICY IF EXISTS liquidaciones_storage_read ON storage.objects;
DROP POLICY IF EXISTS liquidaciones_select_owner_or_admin ON storage.objects;
CREATE POLICY liquidaciones_select_owner_or_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'Liquidaciones'
    AND (
      (storage.foldername(name))[1] = (
        SELECT p.id::text
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('admin', 'super_admin')
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Red de seguridad para el linter 0028:
--    ninguna función SECURITY DEFINER de `public` debe ser ejecutable por anon.
--    (Si más adelante se crean funciones nuevas con SECURITY DEFINER, este
--    bloque las cubre sin necesidad de tocar la lista de arriba.)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    RAISE NOTICE 'EXECUTE de anon revocado en public.%', r.proname;
  END LOOP;
END
$$;

-- Aviso (no revoca nada): funciones SECURITY DEFINER de public que todavía
-- puede ejecutar `authenticated`. Sólo deberían quedar las que la app usa.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    RAISE NOTICE 'Pendiente revisar: public.%(%) sigue siendo SECURITY DEFINER y ejecutable por authenticated',
      r.proname, r.args;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 9. Recargar el cache de PostgREST para que tome las nuevas firmas/wrappers.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificación sugerida (ejecutar aparte, después de la migración):
--
-- -- 0028/0029: no deberían quedar funciones SECURITY DEFINER en public
-- -- ejecutables por anon/authenticated.
-- SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.prosecdef
--   AND n.nspname = 'public'
--   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
--        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
--
-- -- 0025: políticas SELECT sobre storage.objects
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('SELECT','ALL');
-- ============================================================================
