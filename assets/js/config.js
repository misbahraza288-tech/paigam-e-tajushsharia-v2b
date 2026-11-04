// ==== CONFIG — the only file you edit to go live ====
// DEMO MODE: leave both values empty. Data lives in this browser only; admin login is demo / demo.
// LIVE MODE: paste your own Supabase project URL and anon (public) key here. Never paste a service_role key.
window.TAJ_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Telegram forwarding happens inside the Supabase Edge Function (secret set in Supabase, not here).
  contactFunction: "forward-contact"
};
