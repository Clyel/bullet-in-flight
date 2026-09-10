import React, { useState } from "react";
import { C } from "./theme.js";
import { Field, Segmented } from "./ui.jsx";
import { useAuth } from "../AuthContext.jsx";

const linkButtonStyle = {
  background: "none", border: "none", cursor: "pointer", padding: 0,
  color: C.steel, textDecoration: "underline",
  font: "500 12px 'IBM Plex Sans',sans-serif",
};

/** Signed-out: a "Sign in" link that opens a modal with Sign in/Sign up
 *  modes. Signed-in: username (falls back to email if no username landed
 *  yet — see the sign-up flow's own comment) plus a Sign out link. Lives in
 *  App.jsx's header, next to the Imperial/Metric toggle. */
export default function AuthPanel() {
  const { user, signUp, signIn, signOut, authModalMode, openAuthModal, closeAuthModal } = useAuth();

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ font: "500 12px 'IBM Plex Sans',sans-serif", color: C.ink }}>
          {user.user_metadata?.username || user.email}
        </span>
        <button onClick={() => signOut()} style={linkButtonStyle}>Sign out</button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => openAuthModal("Sign in")} style={linkButtonStyle}>Sign in</button>
      {authModalMode && (
        <AuthModal initialMode={authModalMode} onClose={closeAuthModal} signUp={signUp} signIn={signIn} />
      )}
    </>
  );
}

function AuthModal({ initialMode, onClose, signUp, signIn }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim() && password && (mode === "Sign in" || username.trim()) && !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    const { error } = mode === "Sign up"
      ? await signUp(email.trim(), password, username.trim())
      : await signIn(email.trim(), password);
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (mode === "Sign up") {
      // Supabase's default project setting requires clicking a confirmation
      // link before a session exists — signUp() succeeding here does NOT
      // mean they're signed in yet, so this stays open with a notice
      // instead of closing like a successful sign-in does.
      setNotice("Check your email for a confirmation link, then sign in.");
    } else {
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "var(--c-scrim)",
               display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, border: `1.5px solid ${C.ink}`, padding: 20, width: 320, maxWidth: "90vw" }}
      >
        <div style={{ marginBottom: 14 }}>
          <Segmented
            options={["Sign in", "Sign up"]}
            value={mode}
            onChange={(v) => { setMode(v); setError(""); setNotice(""); }}
          />
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "Sign up" && (
            <Field label="Username" hint="How you'll appear in the app — not what you log in with." inputMode="text"
                   value={username} onChange={setUsername} />
          )}
          <Field label="Email" inputMode="email" value={email} onChange={setEmail} />
          <Field label="Password" type="password" inputMode="text" value={password} onChange={setPassword} />

          {error && (
            <div style={{ marginBottom: 12, font: "500 12px/1.4 'IBM Plex Sans',sans-serif", color: C.ox }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ marginBottom: 12, font: "500 12px/1.4 'IBM Plex Sans',sans-serif", color: C.vitals }}>
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{ width: "100%", padding: 9, marginBottom: 8,
                     background: canSubmit ? C.ink : C.rule, color: C.card,
                     border: "none", cursor: canSubmit ? "pointer" : "default",
                     font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
          >
            {busy ? "Working…" : mode}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ width: "100%", padding: 8, background: "none", color: C.muted,
                     border: "none", cursor: "pointer", font: "500 11px 'IBM Plex Sans',sans-serif" }}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
