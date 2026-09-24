/**
 * Supabase client for the Support Scheduler module.
 *
 * Uses its own project URL + anon key (separate from the portal's RDS).
 * Set NEXT_PUBLIC_SCHEDULER_SUPABASE_URL and
 *     NEXT_PUBLIC_SCHEDULER_SUPABASE_ANON_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SCHEDULER_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SCHEDULER_SUPABASE_ANON_KEY ?? "";

export const schedulerSupabase = createClient(url, key);

/**
 * A second client used only when creating new auth users (e.g. admin-
 * provisioned accounts). Avoids overwriting the current admin session.
 */
export const schedulerSupabaseSignup = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
