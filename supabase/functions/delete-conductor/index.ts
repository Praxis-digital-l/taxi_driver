import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { user_id } = await req.json();

    if (!user_id) {
      return json({ error: "user_id es requerido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // --- Autorización -------------------------------------------------------
    // La función borra datos con service_role, así que sólo un administrador
    // puede invocarla. La anon key es pública: no basta con que venga un JWT.
    const accessToken = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!accessToken) {
      return json({ error: "No autenticado" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!callerRes.ok) {
      return json({ error: "No autenticado" }, 401);
    }
    const caller = await callerRes.json();
    const callerUserId = caller?.id ?? null;
    if (!callerUserId) {
      return json({ error: "No autenticado" }, 401);
    }

    if (callerUserId === user_id) {
      return json({ error: "No puedes eliminar tu propia cuenta" }, 400);
    }

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (callerError) {
      return json({ error: `No se pudo verificar el rol: ${callerError.message}` }, 500);
    }

    if (callerProfile?.role !== "admin" && callerProfile?.role !== "super_admin") {
      return json({ error: "No autorizado: se requiere rol de administrador" }, 403);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (profileError) {
      return json({ error: "Perfil no encontrado" }, 404);
    }

    await supabaseAdmin.from("vehicle_assignments").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("documents").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("requests").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("mileage_records").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("messages").delete().or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
    await supabaseAdmin.from("admin_notes").delete().eq("admin_id", profile.id);

    await supabaseAdmin.auth.admin.deleteUser(user_id);

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message || "Error interno en delete-conductor" }, 500);
  }
});
