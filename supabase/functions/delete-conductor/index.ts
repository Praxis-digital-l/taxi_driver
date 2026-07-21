import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es requerido" }), { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), { status: 404 });
    }

    await supabaseAdmin.from("vehicle_assignments").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("documents").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("requests").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("mileage_records").delete().eq("profile_id", profile.id);
    await supabaseAdmin.from("messages").delete().or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
    await supabaseAdmin.from("admin_notes").delete().eq("admin_id", profile.id);

    await supabaseAdmin.auth.admin.deleteUser(user_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
