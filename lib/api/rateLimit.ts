import { createServiceClient } from "@/lib/supabase/serviceClient";
import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 20;

export interface RateLimitResult {
  allowed: boolean;
}

/**
 * IP-keyed rate limit (CLAUDE.md Section 15 — abuse protection, not auth).
 */
export async function checkRateLimit(
  key: string,
  supabase: SupabaseClient = createServiceClient(),
): Promise<RateLimitResult> {
  const now = Date.now();

  const { data: existing, error: selectError } = await supabase
    .from("rate_limits")
    .select("window_start, count")
    .eq("key", key)
    .maybeSingle();

  if (selectError) throw selectError;

  if (!existing) {
    const { error } = await supabase
      .from("rate_limits")
      .insert({ key, window_start: new Date(now).toISOString(), count: 1 });
    if (error) throw error;
    return { allowed: true };
  }

  const windowStart = new Date(existing.window_start).getTime();
  const windowExpired = now - windowStart > WINDOW_MS;

  if (windowExpired) {
    const { error } = await supabase
      .from("rate_limits")
      .update({ window_start: new Date(now).toISOString(), count: 1 })
      .eq("key", key);
    if (error) throw error;
    return { allowed: true };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false };
  }

  const { error } = await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("key", key);
  if (error) throw error;

  return { allowed: true };
}
