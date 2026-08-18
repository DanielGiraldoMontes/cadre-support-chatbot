import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client, per the standard @supabase/ssr pattern. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
