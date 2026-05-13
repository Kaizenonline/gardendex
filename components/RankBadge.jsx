// components/RankBadge.jsx
// Displays current rank, progress to next rank, and a rank-up celebration modal.


import { RANKS, getRank, getNextRank, getProgressToNextRank } from "../lib/ranks";

// ── Compact header badge ──────────────────────────────────────────────────────
export function RankBadgeCompact({ totalWins, dark, onClick }) {
  const rank = getRank(totalWins);
  const next = getNextRank(totalWins);
  const progress = getProgressToNextRank(totalWins);
  const winsToNext = next ? next.winsNeeded - totalWins : 0;

  return (
    <button onClick={onClick} style={{
      background: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.18)",
      border: `1.5px solid ${rank.color}55`,
      borderRadius: 11, padding: "7px 14px",
      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
      transition: "all 0.2s", fontFamily: "system-ui, sans-serif",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
      onMouseLeave={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.18)"}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{rank.badge}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 90 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", lineHeight: 1 }}>
          {rank.title}
        </span>
        {next ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: rank.color, borderRadius: 2, transition: "width 0.5s ease" }} />
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
              {winsToNext}W
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>Max rank</span>
        )}
      </div>
    </button>
  );
}

// ── Rank detail modal ─────────────────────────────────────────────────────────
export function RankModal({ totalWins, dark, onClose }) {
  const currentRank = getRank(totalWins);
  const next = getNextRank(totalWins);
  const progress = getProgressToNextRank(totalWins);
  const bg = dark ? "#141f14" : "#fffdf8";
  const textPrimary = dark ? "#d4ecd4" : "#1a1a1a";
  const textSec = dark ? "#5a7a5a" : "#666";
  const borderColor = dark ? "#2a3e2a" : "#e0e0e0";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, background: bg, borderRadius: 24, border: `2.5px solid ${currentRank.color}`, boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${currentRank.color}33`, fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${currentRank.color}, ${currentRank.color}88)`, padding: "22px 24px 20px", textAlign: "center", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{ fontSize: 52, marginBottom: 8, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" }}>{currentRank.badge}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Rank {currentRank.rank} of 10</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>{currentRank.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>"{currentRank.description}"</div>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Total wins */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: dark ? "#1a2a1c" : "#f0f7f0", borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
            <span style={{ fontSize: 13, color: textSec, fontWeight: 600 }}>Total battle wins</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: currentRank.color }}>{totalWins}</span>
          </div>

          {/* Progress to next */}
          {next ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.07em" }}>Progress to {next.title}</span>
                <span style={{ fontSize: 12, color: currentRank.color, fontWeight: 700 }}>{next.winsNeeded - totalWins} wins to go</span>
              </div>
              <div style={{ height: 10, background: dark ? "#2a3e2a" : "#e8e8e8", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: currentRank.color, borderRadius: 5, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontSize: 10, color: textSec }}>{currentRank.badge} {currentRank.title}</span>
                <span style={{ fontSize: 10, color: textSec }}>{next.badge} {next.title}</span>
              </div>
            </div>
          ) : (
            <div style={{ background: dark ? "#1e1a08" : "#fffbe6", border: `1.5px solid ${dark ? "#4a3a00" : "#ffe082"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#ffd54f" : "#f57c00" }}>🌸 Maximum rank achieved!</div>
              <div style={{ fontSize: 11, color: dark ? "#c8b06a" : "#795548", marginTop: 4 }}>You have transcended the garden. Nothing remains to prove.</div>
            </div>
          )}

          {/* All ranks ladder */}
          <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>All Ranks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {RANKS.map(r => {
              const unlocked = totalWins >= r.winsNeeded;
              const isCurrent = r.rank === currentRank.rank;
              return (
                <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: isCurrent ? `${r.color}22` : (dark ? "transparent" : "transparent"), border: `1px solid ${isCurrent ? r.color : (dark ? "#1e2e1e" : "#f0f0f0")}`, opacity: unlocked ? 1 : 0.45, transition: "all 0.2s" }}>
                  <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{r.badge}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? r.color : textPrimary }}>{r.title}</div>
                    <div style={{ fontSize: 10, color: textSec }}>{r.winsNeeded} wins</div>
                  </div>
                  {isCurrent && <span style={{ fontSize: 9, background: r.color, color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current</span>}
                  {unlocked && !isCurrent && <span style={{ fontSize: 13, color: "#43a047" }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rank-up celebration overlay ───────────────────────────────────────────────
export function RankUpCelebration({ newRank, dark, onClose }) {
  if (!newRank) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 340, background: dark ? "#141f14" : "#fffdf8", borderRadius: 24, border: `3px solid ${newRank.color}`, boxShadow: `0 0 60px ${newRank.color}66`, fontFamily: "system-ui, sans-serif", overflow: "hidden", textAlign: "center" }}>
        <div style={{ background: `linear-gradient(135deg, ${newRank.color}, ${newRank.color}88)`, padding: "28px 24px 24px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>Rank up!</div>
          <div style={{ fontSize: 64, marginBottom: 10, animation: "gd-rank-bounce 0.6s ease-out" }}>{newRank.badge}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>{newRank.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 8, fontStyle: "italic" }}>"{newRank.description}"</div>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ fontSize: 13, color: dark ? "#7aaa7a" : "#555", marginBottom: 16, lineHeight: 1.6 }}>
            You've reached <strong>Rank {newRank.rank}</strong>. The garden trembles.
          </div>
          <button onClick={onClose} style={{ width: "100%", padding: "12px 0", background: `linear-gradient(135deg, ${newRank.color}, ${newRank.color}88)`, border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            Claim Your Title
          </button>
        </div>
      </div>
      <style>{`@keyframes gd-rank-bounce { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}
