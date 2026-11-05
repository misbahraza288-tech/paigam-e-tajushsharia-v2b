// ==== CONFIG — the only file the owner edits to go live ====
// DEMO MODE (default): leave supabaseUrl and supabaseAnonKey empty. Data lives in this browser only; admin login is demo / demo.
// LIVE MODE: paste the Project URL and the anon (public) key from Supabase -> Settings -> API.
//            NEVER paste a service_role key here. See docs/OWNER-GUIDE.md.
window.TAJ_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Hidden owner-panel route (the footer copyright line, tapped 3 times, opens it too). Change it if you like.
  adminRoute: "o7f3k2m9qx",
  // Edge Function that forwards a new contact message to the owner's Telegram (optional; secrets live in Supabase).
  contactFunction: "forward-contact",
  // Web Push (optional). The PUBLIC VAPID key goes here; the PRIVATE key is a Supabase secret, never in this file.
  // Leave empty and the bell still works; the phone-alert button simply does not show.
  vapidPublicKey: "",
  // Edge Function that sends the push (supabase/functions/send-push). Owner deploys it.
  pushFunction: "send-push"
};
