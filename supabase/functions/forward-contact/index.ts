// Supabase Edge Function: forwards ONE new contact message to the owner's Telegram.
// Secrets (set in Supabase, never in the website code):
//   TELEGRAM_BOT_TOKEN  — from @BotFather
//   TELEGRAM_CHAT_ID    — the owner's chat id
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function.
// Deploy: supabase functions deploy forward-contact --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { id } = await req.json();
    if (!id || typeof id !== 'string') return new Response('bad request', { status: 400, headers: cors });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: m, error } = await sb.from('messages').select('*').eq('id', id).single();
    if (error || !m) return new Response('not found', { status: 404, headers: cors });
    // Only forward a fresh message once, so the endpoint cannot be used to spam the owner.
    const age = Date.now() - new Date(m.created).getTime();
    if (m.forwarded || age > 10 * 60 * 1000) return new Response('skipped', { headers: cors });
    const text = [
      'Naya message — Paighaam site',
      'Naam: ' + (m.name || ''),
      m.email ? 'Email: ' + m.email : '',
      m.phone ? 'Phone: ' + m.phone : '',
      '',
      m.message || '',
    ].filter((x) => x !== '').join('\n');
    const tg = await fetch(`https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: Deno.env.get('TELEGRAM_CHAT_ID'), text }),
    });
    if (!tg.ok) return new Response('telegram refused', { status: 502, headers: cors });
    await sb.from('messages').update({ forwarded: true }).eq('id', id);
    return new Response('ok', { headers: cors });
  } catch (e) {
    return new Response('error', { status: 500, headers: cors });
  }
});
