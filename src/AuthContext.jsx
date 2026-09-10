import React, { createContext, useContext, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabaseClient.js";

// Mirrors UnitsContext.jsx's shape (Provider + useX hook) rather than
// introducing a different pattern for the second piece of app-wide state.
const AuthContext = createContext(null);

const AUTH_DISABLED = { error: { message: "Accounts are disabled in this build." } };

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Starts true so nothing renders a flash of "signed out" before the
  // initial getSession() call (below) has actually had a chance to answer —
  // unless auth isn't configured at all, in which case there's nothing to
  // wait for and "signed out" is the final answer.
  const [loading, setLoading] = useState(isSupabaseConfigured);
  // Lives here (not local state inside AuthPanel) so any page can open the
  // sign-up modal directly -- e.g. a "create a free account" nudge next to
  // a guest's Save button, not just the header's own "Sign in" link.
  const [authModalMode, setAuthModalMode] = useState(null); // null | "Sign in" | "Sign up"

  useEffect(() => {
    // supabase-js is loaded lazily (see supabaseClient.js), so this whole
    // thing is async. Local-only mode (no env) resolves to null and we just
    // stay permanently signed-out — every storage hook already falls back
    // to localStorage when there's no user.
    let subscription;
    let cancelled = false;
    (async () => {
      const supabase = await getSupabase();
      if (cancelled || !supabase) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
      // Keeps session state in sync with sign-in/out/token-refresh events
      // that happen elsewhere (e.g. a token expiring), not just this tab's.
      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });
      subscription = listener.subscription;
    })();
    return () => { cancelled = true; subscription?.unsubscribe(); };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    authAvailable: isSupabaseConfigured,
    signUp: async (email, password, username) => {
      const supabase = await getSupabase();
      return supabase
        ? supabase.auth.signUp({ email, password, options: { data: { username } } })
        : AUTH_DISABLED;
    },
    signIn: async (email, password) => {
      const supabase = await getSupabase();
      return supabase ? supabase.auth.signInWithPassword({ email, password }) : AUTH_DISABLED;
    },
    signOut: async () => {
      const supabase = await getSupabase();
      return supabase ? supabase.auth.signOut() : AUTH_DISABLED;
    },
    authModalMode,
    openAuthModal: (mode = "Sign in") => setAuthModalMode(mode),
    closeAuthModal: () => setAuthModalMode(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
