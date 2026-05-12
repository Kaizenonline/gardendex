// components/DailyChallenge.jsx
// Daily challenge modal — pick your champion, fight today's opponent, track streak.
// One challenge per calendar day. Uses seeded random so the same opponent
// appears for everyone on the same day.

import { useState } from "react";
import { getBattleStats } from "./BattleSystem";
import { getDailyState, completeDailyChallenge } from "../lib/dailyChallenge";
import { ATTACKS } from "../lib/attacks";

const RARITY_COLOR = { Common: "#78909c", Uncommon: "#43a047", Rare: "#1e88e5", Legendary: "#e65100" };

function timeUntilMidnight() {
  const now  = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const diff = next - now;
  const h    = Math.floor(diff / 3600000);
  const m    = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function FighterTile({ plant, selected, onClick, dark }) {
  const bs  = getBattleStats(plant);
  const col = RARITY_COLOR[plant.rarity] || "#78909c";
  return (
    <div
      onClick={onClick}
      style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", border: `2px solid ${selected ? "#f9a825" : col + "55"}`, background: selected ? (dark ? "#1e1a08" : "#fffde7") : (dark ? "#1a2a1c" : "#fffdf8"), transform: selected ? "scale(1.04)" : "scale(1)", transition: "all 0.18s", fontFamily: "system-ui,sans-serif" }}
    >
      <div style={{ height: 72, background: dark ? "#0e1a0e" : "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {plant.image ? <img src={plant.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 36 }}>{plant.emoji}</span>}
      </div>
      <div style={{ padding: "6px 8px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plant.name}</div>
        <div style={{ fontSize: 9, color: col, marginBottom: 3 }}>{plant.rarity}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: dark ? "#5a7a5a" : "#888" }}>
          <span>⚡{bs.attack}</span><span>🛡{bs.defense}</span>
        </div>
      </div>
    </div>
  );
}

export default function DailyChallenge({ plants, onClose, onBattle, dark }) {
  const dailyState = getDailyState(plants);
  const opponent   = plants.find(p => p.id === dailyState?.opponentId) || plants[0];
  const [champion, setChampion] = useState(null);

  const bg     = dark ? "#141f14" : "#fffdf8";
  const ts     = dark ? "#5a7a5a" : "#666";
  const bd     = dark ? "#2a3e2a" : "#e0e0e0";
  const streak = dailyState?.streak || 0;

  if (!opponent || plants.length < 2) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 340, background: dark ? "#141f14" : "#fffdf8", borderRadius: 20, border: "2px solid #e0e0e0", padding: "32px 28px", textAlign: "center", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a", marginBottom: 8 }}>Need more plants!</div>
        <div style={{ fontSize: 13, color: dark ? "#5a7a5a" : "#666", marginBottom: 20 }}>Add at least 2 plants to your collection to unlock daily challenges.</div>
        <button onClick={onClose} style={{ padding: "10px 24px", background: "#2e7d32", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Got it</button>
      </div>
    </div>
  );

  const bs = getBattleStats(opponent);
  const moves = ATTACKS[opponent.type] || ATTACKS.Other;

  // ── Already completed today ──
  if (dailyState?.completed) {
    const won = dailyState.playerWon;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ width: 380, background: bg, borderRadius: 24, border: `2px solid ${won ? "#43a047" : "#e53935"}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
          <div style={{ background: `linear-gradient(135deg,${won ? "#2e7d32,#1b5e20" : "#c62828,#b71c1c"})`, padding: "20px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>{won ? "🏆" : "💀"}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{won ? "Challenge Complete!" : "Defeated Today"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
              {won ? `Win streak: ${streak} 🔥` : "Better luck tomorrow"}
            </div>
          </div>
          <div style={{ padding: "18px 22px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: ts, marginBottom: 6 }}>Today's opponent was</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 18 }}>
              <span style={{ fontSize: 32 }}>{opponent.emoji}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a" }}>{opponent.name}</div>
                <div style={{ fontSize: 11, color: ts }}>{opponent.rarity} {opponent.type}</div>
              </div>
            </div>
            <div style={{ background: dark ? "#1a2a1c" : "#f0f7f0", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: ts }}>
              ⏰ Next challenge in <strong style={{ color: dark ? "#7aaa7a" : "#2e7d32" }}>{timeUntilMidnight()}</strong>
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: "11px 0", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${bd}`, borderRadius: 12, color: ts, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active challenge ──
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxHeight: "90vh", overflowY: "auto", background: bg, borderRadius: 24, border: `2px solid ${bd}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#f57f17,#e65100)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>⚡ Daily Challenge</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {streak > 0 ? `🔥 ${streak}-day win streak!` : "A new opponent awaits — fight daily to build a streak"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "18px 20px 22px" }}>
          {/* Streak bar */}
          {streak > 0 && (
            <div style={{ background: dark ? "#1e1a08" : "#fff8e1", border: `1.5px solid ${dark ? "#4a3a00" : "#ffe082"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🔥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: dark ? "#c8a020" : "#f57f17" }}>{streak}-day win streak</div>
                <div style={{ fontSize: 10, color: dark ? "#7a6020" : "#a68a00" }}>Keep it up — defeat today's opponent to extend it!</div>
              </div>
            </div>
          )}

          {/* Today's opponent */}
          <div style={{ background: dark ? "#1a1e2e" : "#e8eaf6", border: `1.5px solid ${dark ? "#2a3060" : "#c5cae9"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#9fa8da" : "#3949ab", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              ⚔️ Today's Opponent
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 72, height: 72, borderRadius: 12, background: dark ? "#0e1a0e" : "#f0f7f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, flexShrink: 0, overflow: "hidden" }}>
                {opponent.image ? <img src={opponent.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : opponent.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: dark ? "#d4ecd4" : "#1a1a1a" }}>{opponent.name}</div>
                <div style={{ fontSize: 11, color: RARITY_COLOR[opponent.rarity] || "#888", marginBottom: 6 }}>{opponent.rarity} {opponent.type}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: ts }}>
                  <span>⚡ {bs.attack}</span>
                  <span>🛡 {bs.defense}</span>
                  <span>💨 {bs.speed}</span>
                  <span>❤️ {bs.hp}</span>
                </div>
                <div style={{ fontSize: 10, color: ts, marginTop: 5 }}>
                  {moves.map(m => `${m.name} (${m.pp}PP)`).join(" · ")}
                </div>
              </div>
            </div>
          </div>

          {/* Pick champion */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Your Champion{champion ? ` — ${champion.name}` : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8 }}>
              {plants.filter(p => p.id !== opponent.id).map(p => (
                <FighterTile key={p.id} plant={p} selected={champion?.id === p.id} onClick={() => setChampion(p)} dark={dark} />
              ))}
            </div>
          </div>

          {/* Rewards info */}
          <div style={{ background: dark ? "#1a2a1c" : "#f0f7f0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: ts, lineHeight: 1.7 }}>
            <strong style={{ color: dark ? "#7aaa7a" : "#2e7d32" }}>Rewards:</strong> Win for a +1 streak bonus and progress toward the streak achievements (Hat Trick, On A Roll, Unstoppable). Lose and your streak resets. One challenge per day — resets at midnight.
          </div>

          <button
            onClick={() => { if (champion) onBattle(champion, opponent, dailyState); }}
            disabled={!champion}
            style={{ width: "100%", padding: "13px 0", background: champion ? "linear-gradient(135deg,#f57f17,#e65100)" : (dark ? "#2a2a2a" : "#e0e0e0"), border: "none", borderRadius: 12, color: champion ? "#fff" : (dark ? "#4a4a4a" : "#aaa"), fontSize: 15, fontWeight: 800, cursor: champion ? "pointer" : "not-allowed" }}
          >
            {champion ? "⚡ Accept Challenge!" : "Select your champion first"}
          </button>
        </div>
      </div>
    </div>
  );
}
