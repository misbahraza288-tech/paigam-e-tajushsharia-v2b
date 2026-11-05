// Supabase Edge Function: sends a Web Push for one notification to every subscribed phone.
// Owner-only: the caller's own login must pass public.is_owner(). The service-role key is a Supabase SECRET
// (never in the site code). VAPID keys are secrets too. Deploy:  supabase functions deploy send-push
// Secrets to set (dashboard -> Edge Functions -> Secrets, or CLI):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:owner@example.com), ALLOWED_ORIGIN (https://misbahraza288-tech.github.io or your .in site)
// NOTE: written and reviewed, NOT tested against real push services or real phones (2026-11-05).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // secret; used only server-side here

  // 1) who is calling? the owner's own session must pass is_owner()
  const who = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: owner, error: ownErr } = await who.rpc("is_owner");
  if (ownErr || owner !== true) return json({ error: "not_owner" }, 403);

  // 2) which notification
  let body: any = {};
  try { body = await req.json(); } catch (_) { return json({ error: "bad_json" }, 400); }
  const id = String(body.notification_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_id" }, 400);

  const admin = createClient(url, service);
  const { data: note, error: noteErr } = await admin.from("notifications").select("title, body, link").eq("id", id).single();
  if (noteErr || !note) return json({ error: "not_found" }, 404);

  // 3) every subscribed phone
  const { data: subs, error: subErr } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (subErr) return json({ error: "subs" }, 500);

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:owner@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
  const payload = JSON.stringify({ title: note.title, body: note.body || "", link: note.link || "#/", tag: id });
  let sent = 0; const gone: string[] = [];
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e: any) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint); // phone unsubscribed: forget it
    }
  }
  if (gone.length) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  return json({ sent, failed: (subs || []).length - sent, removed: gone.length });
});
