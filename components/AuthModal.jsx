import { useState } from "react";
import { getSupabase } from "../lib/supabase";

export default function AuthModal({ onClose, dark }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState("signin"); // "signin" | "signup"
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [sent, setSent]         = useState(false);

  const bg      = dark ? "#141f14" : "#fffdf8";
  const border  = dark ? "#2a3e2a" : "#c8e6c9";
  const text    = dark ? "#d4ecd4" : "#1a2e1a";
  const muted   = dark ? "#6a8a6a" : "#5a7a5a";
  const inputBg = dark ? "#1e2e1e" : "#f0f7f0";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabase();
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSent(true);
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300, padding: 20, fontFamily: "system-ui,sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: bg, border: `2px solid ${border}`, borderRadius: 20,
          padding: 32, maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: text }}>
            {mode === "signin" ? "Welcome back" : "Create account"}
          </div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>
            Save your collection to the cloud
          </div>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 14, color: text, fontWeight: 600 }}>Check your email</div>
            <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>
              We sent a confirmation link to <strong>{email}</strong>
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 20, width: "100%", padding: "11px 0",
                background: "linear-gradient(135deg,#2e7d32,#1b5e20)",
                border: "none", borderRadius: 10, color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <input
                type="email" required placeholder="Email"
                value={email} onChange={e => setEmail(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: `1.5px solid ${border}`, background: inputBg,
                  color: text, fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <input
                type="password" required placeholder="Password" minLength={6}
                value={password} onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: `1.5px solid ${border}`, background: inputBg,
                  color: text, fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{
                background: dark ? "#2a1a1a" : "#fff3f3",
                border: "1px solid #f87171", borderRadius: 8,
                padding: "10px 14px", marginBottom: 14,
                fontSize: 13, color: "#ef5350",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "12px 0",
                background: loading ? "#4a6a4a" : "linear-gradient(135deg,#2e7d32,#1b5e20)",
                border: "none", borderRadius: 10, color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button
                type="button"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#4caf50", fontSize: 13, textDecoration: "underline",
                }}
              >
                {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
