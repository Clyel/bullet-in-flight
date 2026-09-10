// One shared Supabase client for the whole app. Both env values are
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
// `@supabase/supabase-js` is ~58 KB gzip and matters only for accounts and
// cloud sync — the solver, catalog, charts and every localStorage feature
// need none of it. So it's a DYNAMIC import behind getSupabase(), kept off
// the initial bundle; AuthContext calls it from a mount effect, after first
// paint. If the env vars are absent (a fork, `npm run dev` with no
// .env.local, a bad CI secret) getSupabase() resolves to null and the app
// runs local-only — this must never throw at import, the calculator is the
// product. isSupabaseConfigured lets the auth layer say so up front without
// awaiting anything.

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

let clientPromise = null;

/**
 * The shared client, created once on first call, or null if the env isn't
 * configured. Always await it — the underlying library load is dynamic.
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient | null>}
 */
export function getSupabase() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(supabaseUrl, supabaseKey)
    );
  }
  return clientPromise;
}
