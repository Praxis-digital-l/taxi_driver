# Hardening de seguridad — 2026-10-29

Corrección de los avisos del **Supabase Database Linter** sin cambiar el
comportamiento de la aplicación.

| Aviso | Estado | Cómo se corrige |
|---|---|---|
| `public_bucket_allows_listing` × 3 (Avatares, Documents, Liquidaciones) | ✅ SQL | Se reemplazan las políticas `SELECT` amplias por políticas acotadas: dueño de la carpeta o admin/super_admin. Los buckets siguen públicos (`getPublicUrl` sigue funcionando). |
| `anon_security_definer_function_executable` × 20 | ✅ SQL | Se revoca `EXECUTE` de `anon` y del grant implícito a `PUBLIC`. |
| `authenticated_security_definer_function_executable` × 20 | ✅ SQL | La lógica privilegiada se mueve al schema `private` (no expuesto por PostgREST) y en `public` queda un wrapper `SECURITY INVOKER` con la misma firma. Las funciones de trigger y las administrativas legacy ya no son ejecutables por `authenticated`. |
| `auth_leaked_password_protection` | ⚠️ Manual | Es un ajuste de **Supabase Auth**, no de la base de datos. Ver abajo. |

Migración: `supabase/migrations/20261029120000_security_hardening.sql`

---

## 1. Aplicar la migración

### Opción A — SQL Editor (la más fiable)

Dashboard → **SQL Editor** → pegar el contenido completo de
`supabase/migrations/20261029120000_security_hardening.sql` → **Run**.

> La migración es **idempotente**: se puede ejecutar más de una vez.
> Si el editor se queja de que la consulta es muy grande, ejecútala por
> secciones (1-4, 5, 6-7, 8-9) en ese orden.

### Opción B — script del repo

Sólo funciona si la base tiene la función RPC `exec_sql` (no es el caso por
defecto); si no existe, el script te mostrará estas mismas instrucciones
manuales. Necesita la **Service Role Key** (Dashboard → Settings → API):

```powershell
node scripts/apply-migration.mjs supabase/migrations/20261029120000_security_hardening.sql
```

### Opción C — Supabase CLI (si está instalada y el proyecto linkeado)

```powershell
supabase db push
```

---

## 2. Activar protección de contraseñas filtradas (manual)

No existe SQL para esto; se configura en el servicio de Auth.

1. Dashboard → **Authentication** → **Providers** → **Email**.
2. Activar **Prevent use of leaked passwords** (Leaked password protection).
3. Guardar.

Equivalente vía Management API (requiere un *personal access token*):

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/ywcgtwlhievzgflmncsq/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "password_hibp_enabled": true }'
```

Verificar:

```bash
curl "https://api.supabase.com/v1/projects/ywcgtwlhievzgflmncsq/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

---

## 3. Verificación

Ejecutar en el SQL Editor:

```sql
-- 0028/0029: no deberían quedar SECURITY DEFINER en public ejecutables
-- por anon/authenticated.
SELECT n.nspname, p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
  AND n.nspname = 'public'
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

-- 0025: revisar que las políticas SELECT de storage no sean "sólo bucket_id".
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd IN ('SELECT', 'ALL')
ORDER BY policyname;
```

Después, en el Dashboard → **Database** → **Linter** → **Refresh**.

Pruebas funcionales recomendadas:

- Conductor: subir/ver/descargar/eliminar un documento (Documents).
- Conductor: subir foto de perfil (Avatares).
- Admin: ver/descargar documentos de cualquier conductor.
- Admin: descargar PDF de una liquidación y firmar.
- Conductor: abrir mensajes y verificar que se marcan como vistos.
- Admin: crear/editar/eliminar un conductor.
- Cualquier rol: dashboard y "Conductor del mes".

---

## 4. Detalles importantes para no romper nada

- **Las RPC de la app siguen existiendo en `public`** con la misma firma y los
  mismos nombres de parámetros. `mark_message_read` y
  `get_conductor_del_mes` ahora son wrappers `SECURITY INVOKER` que llaman a la
  implementación real en `private`.
- **Las políticas RLS existentes siguen funcionando**: referencian las
  funciones por OID, por lo que moverlas de schema no las rompe.
- **`private` no está expuesto por PostgREST**, así que esas funciones no son
  invocables vía `/rest/v1/rpc/...`.
- Se agregó `NOTIFY pgrst, 'reload schema'` para refrescar el cache de la API.
- **No re-ejecutes scripts antiguos** (`supabase/conductor_del_mes.sql`,
  `fix_functions_user_id.sql`, `messages_rls_policy.sql`, etc.) sin volver a
  ejecutar esta migración después: esos scripts recrean funciones/políticas en
  `public` y reintroducirían los avisos.
- **Las políticas amplias de Storage se buscan por expresión, no por nombre.**
  Las de `Documents` y `Liquidaciones` se crearon desde el Dashboard y podían
  llamarse de cualquier forma; la migración elimina toda política
  `SELECT`/`ALL` cuyo `USING` sea sólo `bucket_id = '<bucket>'` o `true`. Si una
  política amplia era `FOR ALL`, se descompone en `INSERT` + `UPDATE` +
  `DELETE` para no perder la capacidad de subir/borrar archivos.
- Al final la migración deja **avisos en el panel de mensajes** (`NOTICE`) con
  las funciones `SECURITY DEFINER` que todavía puede ejecutar `authenticated`.
  Lo esperado es que sólo aparezcan las que la app usa realmente (si aparece
  alguna más, revisarla).
- Después de ejecutarla, **recarga el Linter**; si el aviso de 0025 persistiera,
  revisa la salida de la consulta de verificación de políticas: significa que
  hay otra política amplia con una expresión distinta (mándamela y la ajusto).

---

## 5. Hallazgo adicional (crítico, fuera del linter de BD) — ya corregido en código

Las Edge Functions `create-conductor` y `delete-conductor` usan la
`SUPABASE_SERVICE_ROLE_KEY` y **no verificaban que quien las invoca sea
administrador**. Cualquier persona con la anon key pública podía invocarlas
para crear usuarios de Auth o borrar usuarios por `user_id`.

Ya se agregó la validación en ambos archivos:

- `supabase/functions/create-conductor/index.ts`
- `supabase/functions/delete-conductor/index.ts`

Qué hacen ahora:

1. Leen el JWT del header `Authorization` (el que envía
   `supabase.functions.invoke` automáticamente) y lo validan contra Auth.
2. Consultan `profiles.role` con `service_role` y exigen
   `admin` o `super_admin`; si no, responden `403`.
3. `delete-conductor` además rechaza que un admin se elimine a sí mismo y ahora
   responde con CORS/`OPTIONS` (antes el navegador podía fallar y la app caía al
   borrado manual).

> **Falta desplegarlas.** Mientras no se desplieguen, el código nuevo no está
> activo. Con la CLI:
>
> ```powershell
> supabase functions deploy create-conductor delete-conductor
> ```
>
> O desde el Dashboard → Edge Functions → cada función → pegar el contenido de
> `index.ts` → Deploy.
>
> Después del despliegue, probar crear / editar / eliminar un conductor desde
> el panel admin. Si el usuario admin no tiene `profiles.role` en
> `('admin','super_admin')`, esas acciones devolverán `403` (revisar el rol).
