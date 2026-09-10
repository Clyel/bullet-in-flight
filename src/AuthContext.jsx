import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

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
    // Local-only mode (no Supabase env): stay permanently signed-out. Every
    // storage hook already falls back to localStorage when there's no user.
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Keeps session state in sync with sign-in/out/token-refresh events
    // that happen elsewhere (e.g. a token expiring), not just the ones
    // this tab's own UI triggers directly.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    authAvailable: isSupabaseConfigured,
    signUp: (email, password, username) =>
      supabase
        ? supabase.auth.signUp({ email, password, options: { data: { username } } })
        : Promise.resolve(AUTH_DISABLED),
    signIn: (email, password) =>
      supabase
        ? supabase.auth.signInWithPassword({ email, password })
        : Promise.resolve(AUTH_DISABLED),
    signOut: () => (supabase ? supabase.auth.signOut() : Promise.resolve(AUTH_DISABLED)),
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
