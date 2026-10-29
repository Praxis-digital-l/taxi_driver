import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      email,
      password,
      nombres,
      apellido_paterno,
      apellido_materno,
      phone,
      rut,
      full_name,
      worker_id,
      existing_user_id,
    } = await req.json();

    let userId: string | null = existing_user_id || null;

    if (!email || (!password && !userId)) {
      return json({ error: "Faltan campos requeridos (Email y Contraseña)" }, 400);
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const gotrueUrl = `${supabaseUrl}/auth/v1`;
    const restUrl = `${supabaseUrl}/rest/v1`;

    const authHeaders = {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    };

    // --- Autorización ---------------------------------------------------------
    // Esta función usa la service_role key, así que hay que comprobar que quien
    // llama sea realmente un administrador. Sin esto, cualquier persona con la
    // anon key pública podría crear/modificar usuarios de Auth.
    const accessToken = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!accessToken) {
      return json({ error: "No autenticado" }, 401);
    }

    const callerRes = await fetch(`${gotrueUrl}/user`, {
      headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${accessToken}` },
    });
    if (!callerRes.ok) {
      return json({ error: "No autenticado" }, 401);
    }
    const caller = await callerRes.json();
    const callerUserId = caller?.id ?? null;

    const callerRoleRes = await fetch(
      `${restUrl}/profiles?user_id=eq.${callerUserId}&select=role&limit=1`,
      { headers: authHeaders }
    );
    const callerRoleRows = await callerRoleRes.json();
    const callerRole = Array.isArray(callerRoleRows) ? callerRoleRows[0]?.role : null;
    if (callerRole !== "admin" && callerRole !== "super_admin") {
      return json({ error: "No autorizado: se requiere rol de administrador" }, 403);
    }

    const metadata = {
      full_name: full_name ?? "",
      nombres: nombres ?? "",
      apellido_paterno: apellido_paterno ?? "",
      apellido_materno: apellido_materno ?? "",
      phone: phone ?? "",
      rut: rut ?? "",
      worker_id: worker_id ?? "",
    };

    if (userId) {
      // Actualizar correo, metadata y (opcionalmente) contraseña de un usuario Auth existente
      const authUpdateBody: Record<string, unknown> = {
        email,
        email_confirm: true,
        user_metadata: metadata,
      };
      if (password && String(password).trim().length >= 6) {
        authUpdateBody.password = String(password).trim();
      }

      const updateRes = await fetch(`${gotrueUrl}/admin/users/${userId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(authUpdateBody),
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return json({ error: `Error al actualizar credenciales: ${errText}` }, 400);
      }
    } else {
      // Crear nuevo usuario en Supabase Auth
      const res = await fetch(`${gotrueUrl}/admin/users`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        }),
      });

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const errMsg = parsed?.msg || parsed?.error_description || parsed?.message || text;
        // Si el correo ya existe en Auth, buscar su user_id o perfil y actualizar contraseña
        if (
          errMsg?.toLowerCase().includes("already") ||
          errMsg?.toLowerCase().includes("exists") ||
          errMsg?.toLowerCase().includes("registered")
        ) {
          const profRes = await fetch(
            `${restUrl}/profiles?email=ilike.${encodeURIComponent(email)}&select=id,user_id&limit=1`,
            { headers: authHeaders }
          );
          const profRows = await profRes.json();
          const foundUserId = Array.isArray(profRows) ? profRows[0]?.user_id : null;

          if (foundUserId) {
            userId = foundUserId;
            await fetch(`${gotrueUrl}/admin/users/${userId}`, {
              method: "PUT",
              headers: authHeaders,
              body: JSON.stringify({
                password,
                email_confirm: true,
                user_metadata: metadata,
              }),
            });
          } else {
            return json({ error: `El correo ${email} ya está registrado en el sistema.` }, 400);
          }
        } else {
          return json({ error: `Error al crear usuario: ${errMsg}` }, 400);
        }
      } else {
        userId = parsed?.id ?? null;
      }
    }

    let profileId: string | null = null;
    if (userId) {
      // Verificar perfil vinculado a userId
      const profRes = await fetch(
        `${restUrl}/profiles?user_id=eq.${userId}&select=id,worker_id&limit=1`,
        { headers: authHeaders }
      );
      const profRows = await profRes.json();
      if (Array.isArray(profRows) && profRows[0]?.id) {
        profileId = profRows[0].id;
        if (worker_id && !profRows[0].worker_id) {
          await fetch(`${restUrl}/profiles?id=eq.${profileId}`, {
            method: "PATCH",
            headers: { ...authHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify({ worker_id }),
          });
        }
      }
    }

    return json({ success: true, user_id: userId, profile_id: profileId });
  } catch (err: any) {
    return json({ error: err.message || "Error interno en create-conductor" }, 500);
  }
});

