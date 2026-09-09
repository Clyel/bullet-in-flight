import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// Mirrors UnitsContext.jsx's shape (Provider + useX hook) rather than
// introducing a different pattern for the second piece of app-wide state.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Starts true so nothing renders a flash of "signed out" before the
  // initial getSession() call (below) has actually had a chance to answer.
  const [loading, setLoading] = useState(true);
  // Lives here (not local state inside AuthPanel) so any page can open the
  // sign-up modal directly -- e.g. a "create a free account" nudge next to
  // a guest's Save button, not just the header's own "Sign in" link.
  const [authModalMode, setAuthModalMode] = useState(null); // null | "Sign in" | "Sign up"

  useEffect(() => {
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
    signUp: (email, password, username) =>
      supabase.auth.signUp({ email, password, options: { data: { username } } }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
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
