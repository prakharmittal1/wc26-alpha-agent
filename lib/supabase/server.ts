import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Returns a Supabase client authenticated with the service-role key.
 *
 * Use for scripts (scripts/ingest.ts) and server-side route handlers only.
 * The runtime guard below blocks accidental browser usage. Pair this with
 * a Next.js `server-only` import at any *App Router* file that pulls it in
 * (we don't import `server-only` here so this module stays runnable from
 * plain Node scripts like scripts/ingest.ts).
 */
export function getServiceSupabase(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServiceSupabase() must never run in the browser. " +
        "It is gated to server scripts and route handlers.",
    );
  }
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.");
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Copy .env.local.example to .env.local and fill it in.");
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "wc26-alpha-agent" } },
  });

  return cached;
}
