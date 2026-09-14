import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@santaaurora.cl";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Decodifica el JWT del caller (sin verificar firma; la verificación la hace Supabase). */
function decodeJwt(token: string): { sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, options: RequestInit) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

const restUrl = (path: string) => `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1${path}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204 });
  }

  try {
    console.log("[push-message] invoked", req.url);

    // 1. Auth: solo admin / super_admin pueden disparar notificaciones
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const jwt = decodeJwt(token);
    if (!jwt?.sub) return json({ error: "No autorizado" }, 401);
    console.log("[push-message] caller sub:", jwt.sub);

    const adminCheck = await fetchJson(
      restUrl(`/profiles?user_id=eq.${jwt.sub}&role=eq.admin&select=id`),
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!adminCheck.ok || !Array.isArray(adminCheck.body) || adminCheck.body.length === 0) {
      console.error("[push-message] auth rejected, adminCheck status:", adminCheck.status, adminCheck.body);
      return json({ error: "No autorizado" }, 401);
    }
    const { receiver_id, message, sender_name } = await req.json();
    console.log("[push-message] body ok, receiver_id:", receiver_id);
    if (!receiver_id || !message) {
      return json({ error: "Faltan campos requeridos (receiver_id, message)" }, 400);
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: "Faltan credenciales VAPID en la edge function" }, 500);
    }

    // 3. Mapear receiver_id (profiles.id) -> user_id (auth.users.id)
    const profileRes = await fetchJson(
      restUrl(`/profiles?id=eq.${receiver_id}&select=user_id,full_name`),
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const profile = Array.isArray(profileRes.body) ? profileRes.body[0] : null;
    if (!profile?.user_id) {
      console.error("[push-message] receiver profile NOT found", { receiver_id, profileResStatus: profileRes.status, body: profileRes.body });
      return json({ ok: true, sent: 0 }, 200);
    }
    console.log("[push-message] receiver mapped to user:", profile.user_id);

    // 4. Buscar suscripciones del destinatario
    const subsRes = await fetchJson(
      restUrl(`/push_subscriptions?user_id=eq.${profile.user_id}&select=id,endpoint,p256dh,auth`),
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const subscriptions = Array.isArray(subsRes.body) ? subsRes.body : [];
    console.log("[push-message] subscriptions found:", subscriptions.length);

    if (subscriptions.length === 0) {
      console.warn("[push-message] no subscriptions for user", profile.user_id);
      return json({ ok: true, sent: 0 }, 200);
    }

    // 5. Configurar web-push
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const from = sender_name ?? "Administración";
    const payload = JSON.stringify({
      title: `Nuevo mensaje de ${from}`,
      body: message,
      url: "/conductor/messages",
      sender: from,
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 3600 },
        );
        sent += 1;
        console.log("[push-message] sent OK:", sub.id);
      } catch (err) {
        const code = err?.statusCode;
        console.error("[push-message] send FAILED:", sub.id, "statusCode:", code, "msg:", err?.message ?? String(err));
        if (code === 404 || code === 410) {
          staleEndpoints.push(sub.id);
        }
      }
    }

    // 6. Limpiar suscripciones caídas
    if (staleEndpoints.length > 0) {
      await fetchJson(restUrl(`/push_subscriptions?id=in.(${staleEndpoints.join(",")})`), {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
    }

    return json({ ok: true, sent, total: subscriptions.length });
  } catch (err) {
    console.error("[push-message] unexpected error:", err?.message ?? err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});