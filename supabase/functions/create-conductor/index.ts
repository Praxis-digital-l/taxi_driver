import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const { email, password, nombres, apellido_paterno, apellido_materno, phone, rut, full_name } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const gotrueUrl = supabaseUrl.replace(/\/$/, "") + "/auth/v1";

    const body = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        nombres,
        apellido_paterno,
        apellido_materno,
        phone,
        rut,
      },
    };

    const res = await fetch(`${gotrueUrl}/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Error al crear usuario", status: res.status, body: text }), { status: 400 });
    }

    let userData;
    try { userData = JSON.parse(text); } catch { userData = null; }

    return new Response(JSON.stringify({ success: true, user_id: userData?.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
