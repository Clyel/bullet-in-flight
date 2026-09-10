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
//
// If the env vars are absent (a fork, a local `npm run dev` with no
// .env.local, a misconfigured CI secret), `supabase` is exported as null
// and the app runs in local-only mode: the solver, catalog, charts, and
// every localStorage-backed feature work unchanged; only account sign-in /
// cloud sync is disabled. This must NOT throw at import — the calculator is
// the product and has zero dependency on Supabase, so a bad env var can't
// be allowed to blank the whole page. `isSupabaseConfigured` lets the auth
// layer say so explicitly instead of guessing from a null.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). " +
    "Running in local-only mode — accounts and cloud sync are disabled. " +
    "Add them to .env.local for local dev (see .env.local.example)."
  );
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;
