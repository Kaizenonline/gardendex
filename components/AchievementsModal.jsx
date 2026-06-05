// components/AchievementsModal.jsx
// Displays all achievements, unlocked vs locked, with rarity colours.
// Also exports the AchievementToast shown when one is unlocked mid-battle.

import { ACHIEVEMENTS, RARITY_COLOR } from "../lib/achievements";

// ── Toast shown immediately on unlock ────────────────────────────────────────
export function AchievementToast({ achievement, onDone }) {
  if (!achievement) return null;
  const rarCol = RARITY_COLOR[achievement.rarity] || "#78909c";
  return (
    <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 600, fontFamily: "system-ui,sans-serif", pointerEvents: "none" }}>
      <div style={{ background: "#1a1a1a", border: `2px solid ${rarCol}`, borderRadius: 16, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${rarCol}44`, minWidth: 280, animation: "gd-toast-in 0.4s cubic-bezier(.34,1.56,.64,1)" }}>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{achievement.emoji}</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: rarCol, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Achievement unlocked · {achievement.rarity}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{achievement.title}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{achievement.description}</div>
        </div>
      </div>
      <style>{`@keyframes gd-toast-in { 0%{transform:translateX(-50%) translateY(40px);opacity:0} 100%{transform:translateX(-50%) translateY(0);opacity:1} }`}</style>
    </div>
  );
}

// ── Full achievements modal ───────────────────────────────────────────────────
export default function AchievementsModal({ unlocked, onClose, dark }) {
  const bg  = dark ? "#141f14" : "#fffdf8";
  const ts  = dark ? "#5a7a5a" : "#666";
  const bd  = dark ? "#2a3e2a" : "#e0e0e0";

  const unlockedCount = Object.keys(unlocked).length;
  const totalCount    = ACHIEVEMENTS.length;
  const pct           = Math.round((unlockedCount / totalCount) * 100);

  const byRarity = { Legendary: [], Rare: [], Uncommon: [], Common: [] };
  for (const ach of ACHIEVEMENTS) {
    (byRarity[ach.rarity] || byRarity.Common).push(ach);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: "88vh", overflowY: "auto", background: bg, borderRadius: 24, border: `2px solid ${bd}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#37474f,#263238)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>🏅 Achievements</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{unlockedCount} / {totalCount} unlocked</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ background: dark ? "#1a2a1c" : "#f0f7f0", padding: "10px 20px", borderBottom: `1px solid ${bd}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: ts, marginBottom: 5 }}>
            <span>Overall progress</span>
            <span style={{ fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: dark ? "#2a3e2a" : "#e0e0e0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#43a047,#2e7d32)", borderRadius: 3, transition: "width 0.6s ease" }} />
          </div>
        </div>

        {/* Achievement groups by rarity */}
        <div style={{ padding: "16px 20px 24px" }}>
          {Object.entries(byRarity).map(([rarity, achs]) => {
            const rarCol = RARITY_COLOR[rarity] || "#78909c";
            return (
              <div key={rarity} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: rarCol, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  {rarity} ({achs.filter(a => unlocked[a.id]).length}/{achs.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {achs.map(ach => {
                    const isUnlocked = !!unlocked[ach.id];
                    const unlockedAt = unlocked[ach.id]?.unlockedAt;
                    return (
                      <div key={ach.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${isUnlocked ? rarCol + "66" : (dark ? "#1e2e1e" : "#f0f0f0")}`, background: isUnlocked ? (dark ? rarCol + "18" : rarCol + "0a") : (dark ? "#0e160e" : "#fafaf8"), opacity: isUnlocked ? 1 : 0.45, transition: "all 0.2s" }}>
                        <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, filter: isUnlocked ? "none" : "grayscale(1)" }}>{ach.emoji}</span>
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isUnlocked ? (dark ? "#d4ecd4" : "#1a1a1a") : ts, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ach.title}</div>
                          <div style={{ fontSize: 10, color: ts, lineHeight: 1.4, marginTop: 1 }}>{ach.description}</div>
                          {isUnlocked && unlockedAt && (
                            <div style={{ fontSize: 9, color: rarCol, marginTop: 3, fontWeight: 600 }}>
                              ✓ {new Date(unlockedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
