import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Server-only client using the service-role key. conversations/messages/
 * escalations/rate_limits have no per-user RLS policy (there's no auth) —
 * RLS defaults to deny for the public/publishable key so that key (which
 * ships to the browser via NEXT_PUBLIC_*) can't read or write this data
 * directly through Supabase's REST API. The service role bypasses RLS and
 * must never be imported from a Client Component.
 */
export function createServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
