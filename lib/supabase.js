// lib/supabase.js
// Supabase clients — initialised lazily so missing env vars don't crash at startup.

import { createClient } from "@supabase/supabase-js";

let _supabase = null;

/** Browser-safe client — call this instead of importing supabase directly */
export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/** Server-only admin client — bypasses RLS. Only use inside /pages/api/ */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Legacy export — returns null if env vars not set (safe, no throw)
export const supabase = new Proxy({}, {
  get(_, prop) {
    const client = getSupabase();
    if (!client) return () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } });
    return client[prop];
  }
});
