// components/CreditBadge.jsx
// Header badge showing scan balance. Opens purchase modal with
// credit packs + Pro upgrade option.

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const PACKS = [
  { id: "starter",           label: "Starter Pack",  credits: "50",  price: "$2.99",    perScan: "6¢/scan",  popular: false, isPro: false },
  { id: "garden",            label: "Garden Pack",   credits: "200", price: "$7.99",    perScan: "4¢/scan",  popular: true,  isPro: false },
  { id: "unlimited_monthly", label: "Unlimited",     credits: "∞",   price: "$4.99/mo", perScan: "~1¢/scan", popular: false, isPro: false },
];

const PRO = {
  id: "pro_lifetime",
  label: "GardenDex Pro",
  credits: "∞",
  price: "$9.99",
  subLabel: "one-time payment",
  perks: [
    "Unlimited scans — forever",
    "Unlimited collection size",
    "🌟 Pro badge",
    "Priority new features",
    "Early access to garden map",
  ],
  isPro: true,
};

export default function CreditBadge({ userId, userEmail, dark }) {
  const [balance, setBalance]     = useState(null);
  const [isPro, setIsPro]         = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => { if (userId) fetchBalance(); }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const pro = params.get("pro") === "true";
      const credits = params.get("credits");
      setSuccessMsg(pro ? "🌟 Welcome to Pro! Unlimited scans unlocked." : `✅ ${credits} scans added!`);
      fetchBalance();
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setSuccessMsg(""), 5000);
    }
  }, []);

  const fetchBalance = async () => {
    const { data } = await supabase
      .from("credits")
      .select("balance, is_pro")
      .eq("user_id", userId)
      .single();
    if (data) { setBalance(data.balance); setIsPro(data.is_pro); }
  };

  const handlePurchase = async (packId) => {
    setLoading(packId);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, userId, userEmail }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const isUnlimited = isPro || balance >= 99999;
  const isEmpty     = !isPro && balance === 0;
  const isLow       = !isPro && balance > 0 && balance <= 3;
  const badgeColor  = isPro ? "#f9a825" : isEmpty ? "#e53935" : isLow ? "#f57c00" : "#43a047";

  const bg          = dark ? "#141f14" : "#fff";
  const textPrimary = dark ? "#d4ecd4" : "#1a1a1a";
  const textSec     = dark ? "#5a7a5a" : "#666";
  const border      = dark ? "#2a3e2a" : "#e0e0e0";

  return (
    <>
      {/* Badge */}
      <button onClick={() => setShowModal(true)} style={{ background: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.15)", border: `1.5px solid ${badgeColor}55`, borderRadius: 10, padding: "7px 14px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
        onMouseLeave={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.15)"}
      >
        <span>{isPro ? "🌟" : "🌿"}</span>
        <span style={{ color: badgeColor }}>{balance === null ? "..." : isUnlimited ? "∞" : balance}</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>{isPro ? "Pro" : "scans"}</span>
        {isLow && <span style={{ color: "#f57c00", fontSize: 10 }}>⚠</span>}
      </button>

      {/* Success toast */}
      {successMsg && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: isPro ? "#f9a825" : "#43a047", color: "#fff", padding: "14px 22px", borderRadius: 14, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", maxWidth: 320 }}>
          {successMsg}
        </div>
      )}

      {/* Purchase modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 460, background: bg, borderRadius: 24, border: `2px solid ${border}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", fontFamily: "system-ui, sans-serif", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #2e7d32, #1b5e20)", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>🌿 Unlock More GardenDex</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Each scan identifies a plant and generates its card</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ padding: "20px 22px 24px" }}>
              {/* Current balance */}
              <div style={{ background: dark ? "#1a2a1c" : "#f0f7f0", borderRadius: 12, padding: "12px 16px", marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: textSec, fontWeight: 600 }}>Your balance</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: badgeColor }}>
                  {isPro ? "🌟 Pro — Unlimited" : isUnlimited ? "∞ Unlimited" : `${balance ?? "..."} scans`}
                </span>
              </div>

              {/* Pro upgrade card — always shown if not already Pro */}
              {!isPro && (
                <div style={{ border: "2.5px solid #f9a825", borderRadius: 16, padding: "18px 18px 16px", marginBottom: 16, background: dark ? "#1e1a08" : "#fffde7", position: "relative" }}>
                  <div style={{ position: "absolute", top: -11, left: 16, background: "#f9a825", color: "#1a1a1a", fontSize: 10, fontWeight: 800, padding: "3px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    ⭐ Best Deal
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: dark ? "#ffd54f" : "#1a1a1a", marginBottom: 6 }}>
                        🌟 GardenDex Pro
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {PRO.perks.map(p => (
                          <div key={p} style={{ fontSize: 12, color: dark ? "#c8b86a" : "#5d4037", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "#f9a825", fontWeight: 700 }}>✓</span> {p}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: dark ? "#ffd54f" : "#1a1a1a" }}>$9.99</div>
                      <div style={{ fontSize: 10, color: textSec, marginBottom: 8 }}>one-time</div>
                      <button onClick={() => handlePurchase("pro_lifetime")} disabled={!!loading} style={{ padding: "9px 20px", background: "linear-gradient(135deg, #f9a825, #f57c00)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 3px 10px rgba(249,168,37,0.4)" }}>
                        {loading === "pro_lifetime" ? "..." : "Upgrade"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Credit packs */}
              <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Or buy scan credits
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {PACKS.map(pack => (
                  <div key={pack.id} style={{ border: `1.5px solid ${pack.popular ? "#2e7d32" : border}`, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: pack.popular ? (dark ? "#1a2e1a" : "#f0f7f0") : bg, position: "relative" }}>
                    {pack.popular && <div style={{ position: "absolute", top: -9, right: 12, background: "#2e7d32", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.07em" }}>Popular</div>}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{pack.label}</div>
                      <div style={{ fontSize: 11, color: textSec, marginTop: 1 }}>{pack.credits} scans · {pack.perScan}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#2e7d32" }}>{pack.price}</div>
                      <button onClick={() => handlePurchase(pack.id)} disabled={!!loading} style={{ marginTop: 5, padding: "6px 14px", background: pack.popular ? "linear-gradient(135deg,#2e7d32,#1b5e20)" : (dark ? "#1e2e1e" : "#f5f5f5"), border: pack.popular ? "none" : `1px solid ${border}`, borderRadius: 8, color: pack.popular ? "#fff" : textSec, fontSize: 11, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
                        {loading === pack.id ? "..." : "Buy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, color: textSec, textAlign: "center", lineHeight: 1.7 }}>
                Payments secured by Stripe · Credits never expire<br />
                Cancel subscriptions any time · VAT included where applicable
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
