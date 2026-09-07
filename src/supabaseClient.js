// One shared Supabase client for the whole app. Both values here are
// deliberately safe to expose client-side (that's what "publishable" means
// in Supabase's current key naming, replacing the old "anon" name) —
// Row Level Security in supabase/schema.sql is what actually governs what
// this client can read or write, not secrecy of the key itself.
//
// Read from Vite env vars rather than hardcoded so the same source works
// against local dev (.env.local, gitignored) and the deployed build (values
// injected as GitHub Actions secrets at build time) without ever committing
// them to the repo either way.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. " +
    "Add them to .env.local for local dev (see .env.local.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
