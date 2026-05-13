import { useState, useEffect, useRef, useCallback } from "react";
import { getRank, getNextRank, getProgressToNextRank, getTotalWins } from "../lib/ranks";
import { ATTACKS, STATUS_EFFECTS, pickAttack, rolledMiss, rollStatus, applyStatusDot, rolledStunSkip } from "../lib/attacks";
import { getEvolutionStage, EVOLUTION_CONFIG } from "../lib/achievements";

// ── Type matchups ─────────────────────────────────────────────────────────────
const TYPE_MATCHUPS = {
  Herb:      { strong: ["Flower","Succulent"], weak: ["Tree","Fruit"] },
  Flower:    { strong: ["Grass","Other"],      weak: ["Herb","Vegetable"] },
  Grass:     { strong: ["Vegetable"],          weak: ["Flower","Fruit"] },
  Vegetable: { strong: ["Fruit","Grass"],      weak: ["Tree","Herb"] },
  Fruit:     { strong: ["Tree","Herb"],        weak: ["Vegetable","Grass"] },
  Tree:      { strong: ["Succulent","Grass"],  weak: ["Fruit","Flower"] },
  Succulent: { strong: ["Herb","Flower"],      weak: ["Tree","Vegetable"] },
  Other:     { strong: [], weak: [] },
};

export function getBattleStats(plant) {
  const { sunlight=50, water=50, difficulty=50 } = plant.stats || {};
  const v = plant.vigor || 50;
  const stage = getEvolutionStage(plant);
  const mult = EVOLUTION_CONFIG[stage].statMult;
  return {
    hp:      Math.round(v * 2 * mult), maxHp: Math.round(v * 2 * mult),
    attack:  Math.round((sunlight * 0.7 + v * 0.3) * mult),
    defense: Math.round(((100 - difficulty) * 0.6 + v * 0.4) * mult),
    speed:   Math.round(water * 0.5 + sunlight * 0.5), // speed unaffected
  };
}

function getMultiplier(at, def) {
  const c = TYPE_MATCHUPS[at] || TYPE_MATCHUPS.Other;
  return c.strong.includes(def) ? 2 : c.weak.includes(def) ? 0.5 : 1;
}

// ── Battle simulation with PP + status effects ────────────────────────────────
function simulateBattle(pA, pB) {
  const a = { ...getBattleStats(pA), name: pA.name, emoji: pA.emoji, type: pA.type, id: pA.id, status: null, poisonStacks: 1 };
  const b = { ...getBattleStats(pB), name: pB.name, emoji: pB.emoji, type: pB.type, id: pB.id, status: null, poisonStacks: 1 };
  const ppA = {}, ppB = {};
  const log = [{ type: "intro", a: { ...a }, b: { ...b }, first: a.speed >= b.speed ? a.name : b.name }];
  let [atk, def, ppAtk, ppDef] = a.speed >= b.speed ? [a, b, ppA, ppB] : [b, a, ppB, ppA];

  for (let t = 0; t < 50 && a.hp > 0 && b.hp > 0; t++) {
    // Stun check — skip turn
    if (rolledStunSkip(atk.status)) {
      log.push({ type: "stunned", name: atk.name, emoji: atk.emoji, aHp: a.hp, bHp: b.hp });
      // Apply DoT even on stun turn
    } else {
      // Speed penalty from root
      const effectiveSpeed = atk.status === "root"
        ? Math.round(atk.speed * STATUS_EFFECTS.root.speedMult)
        : atk.speed;
      const move = pickAttack(atk.type, ppAtk);
      ppAtk[move.name] = (ppAtk[move.name] || 0) + 1;
      const missed = rolledMiss(effectiveSpeed, def.speed);
      const mult = getMultiplier(atk.type, def.type);
      let dmg = 0, newStatus = null;
      if (!missed) {
        dmg = Math.round(Math.max(1, atk.attack * (move.power || 1.0) - def.defense * 0.4) * mult * (0.85 + Math.random() * 0.3));
        def.hp = Math.max(0, def.hp - dmg);
        newStatus = rollStatus(move, def.status);
        if (newStatus) def.status = newStatus;
      }
      log.push({ type: "attack", atkId: atk.id, atkName: atk.name, atkEmoji: atk.emoji, atkType: atk.type, defId: def.id, defName: def.name, move, missed, mult, dmg, newStatus, aHp: a.hp, bHp: b.hp, statusA: a.status, statusB: b.status });
      if (def.hp <= 0) break;
    }

    // End-of-turn DoT for BOTH fighters
    for (const fighter of [a, b]) {
      if (!fighter.status) continue;
      const { damage, newPoisonStacks } = applyStatusDot(fighter.hp, fighter.maxHp, fighter.status, fighter.poisonStacks);
      fighter.hp = Math.max(0, fighter.hp - damage);
      fighter.poisonStacks = newPoisonStacks;
      if (damage > 0) {
        log.push({ type: "dot", name: fighter.name, emoji: fighter.emoji, status: fighter.status, damage, aHp: a.hp, bHp: b.hp });
      }
      if (fighter.hp <= 0) break;
    }
    if (a.hp <= 0 || b.hp <= 0) break;

    [atk, def, ppAtk, ppDef] = [def, atk, ppDef, ppAtk];
  }
  log.push({ type: "result", winner: a.hp > 0 ? pA : pB, loser: a.hp > 0 ? pB : pA });
  return log;
}

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ac = null;
function ac() { if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (_ac?.state === "suspended") _ac.resume(); return _ac; }
function beep(f, type, vol, dur, t0) { const ctx = ac(); if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); const t = t0 || ctx.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.3, t + dur * 0.55); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.start(t); o.stop(t + dur + 0.02); }
function sndHit(mult) { beep(mult >= 2 ? 680 : mult <= 0.5 ? 160 : 360, mult >= 2 ? "sawtooth" : "square", mult >= 2 ? 0.3 : 0.18, 0.18); if (mult >= 2) setTimeout(() => beep(960, "sine", 0.14, 0.25), 60); }
function sndMiss() { const ctx = ac(); if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.setValueAtTime(380, ctx.currentTime); o.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.22); g.gain.setValueAtTime(0.09, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24); o.start(); o.stop(ctx.currentTime + 0.26); }
function sndStatus() { beep(220, "triangle", 0.12, 0.3); }
function sndDot() { beep(180, "sine", 0.08, 0.15); }
function sndVictory() { [523,659,784,1047,1319].forEach((f,i) => { const ctx = ac(); if (!ctx) return; beep(f, "triangle", 0.16, 0.32, ctx.currentTime + i * 0.1); }); }
function sndDefeat() { [392,349,311,261,220].forEach((f,i) => { const ctx = ac(); if (!ctx) return; beep(f, "sine", 0.12, 0.45, ctx.currentTime + i * 0.17); }); }
function sndRankUp() { [523,659,784,659,784,1047,1319,1568].forEach((f,i) => { const ctx = ac(); if (!ctx) return; beep(f, i > 5 ? "triangle" : "square", 0.13, 0.22, ctx.currentTime + i * 0.08); }); }

// ── CSS animations ────────────────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes gd-bob-a  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes gd-bob-b  { 0%,100%{transform:scaleX(-1) translateY(0)} 50%{transform:scaleX(-1) translateY(-4px)} }
@keyframes gd-atk-a  { 0%{transform:translateX(0) scale(1)} 40%{transform:translateX(32px) scale(1.22);filter:brightness(1.3)} 100%{transform:translateX(0) scale(1);filter:none} }
@keyframes gd-atk-b  { 0%{transform:scaleX(-1)} 40%{transform:scaleX(-1) translateX(32px) scale(1.22);filter:brightness(1.3)} 100%{transform:scaleX(-1) translateX(0) scale(1);filter:none} }
@keyframes gd-hit-a  { 0%{transform:translateX(0)} 14%{transform:translateX(-9px);filter:brightness(3) saturate(0.2)} 32%{transform:translateX(9px);filter:brightness(3) saturate(0.2)} 52%{transform:translateX(-5px);filter:none} 74%{transform:translateX(4px)} 100%{transform:translateX(0)} }
@keyframes gd-hit-b  { 0%{transform:scaleX(-1)} 14%{transform:scaleX(-1) translateX(-9px);filter:brightness(3) saturate(0.2)} 32%{transform:scaleX(-1) translateX(9px);filter:brightness(3) saturate(0.2)} 52%{transform:scaleX(-1) translateX(-5px);filter:none} 74%{transform:scaleX(-1) translateX(4px)} 100%{transform:scaleX(-1) translateX(0)} }
@keyframes gd-win-a  { 0%,100%{transform:translateY(0) scale(1)} 25%{transform:translateY(-14px) scale(1.2);filter:brightness(1.4)} 50%{transform:translateY(0)} 75%{transform:translateY(-7px) scale(1.1)} }
@keyframes gd-win-b  { 0%,100%{transform:scaleX(-1) translateY(0) scale(1)} 25%{transform:scaleX(-1) translateY(-14px) scale(1.2);filter:brightness(1.4)} 50%{transform:scaleX(-1) translateY(0)} 75%{transform:scaleX(-1) translateY(-7px) scale(1.1)} }
@keyframes gd-lose-a { 0%{transform:rotate(0) scale(1);opacity:1} 100%{transform:rotate(-28deg) scale(0.7);opacity:0.3} }
@keyframes gd-lose-b { 0%{transform:scaleX(-1)} 100%{transform:scaleX(-1) rotate(28deg) scale(0.7);opacity:0.3} }
@keyframes gd-proj-r { 0%{transform:translateX(0);opacity:1} 100%{transform:translateX(200px);opacity:0} }
@keyframes gd-proj-l { 0%{transform:translateX(0);opacity:1} 100%{transform:translateX(-200px);opacity:0} }
@keyframes gd-float  { 0%{opacity:1;transform:translateY(0) scale(0.85)} 20%{opacity:1;transform:translateY(-12px) scale(1.3)} 100%{opacity:0;transform:translateY(-46px) scale(0.9)} }
@keyframes gd-flash-r{ 0%,100%{background:transparent} 30%{background:rgba(229,57,53,0.16)} }
@keyframes gd-flash-s{ 0%,100%{background:transparent} 30%{background:rgba(249,168,37,0.2)} }
@keyframes gd-flash-p{ 0%,100%{background:transparent} 30%{background:rgba(123,31,162,0.2)} }
@keyframes gd-flash-b{ 0%,100%{background:transparent} 30%{background:rgba(230,74,25,0.2)} }
@keyframes gd-rankpop{ 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.2);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes gd-status-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
`;
// CSS injected via useEffect inside the component (avoids SSR crash)

const SPRITE_ANIM = {
  idle:   { a: "gd-bob-a 1.8s ease-in-out infinite",      b: "gd-bob-b 1.8s ease-in-out infinite 0.4s" },
  attack: { a: "gd-atk-a 0.5s ease-in-out forwards",      b: "gd-atk-b 0.5s ease-in-out forwards" },
  hit:    { a: "gd-hit-a 0.5s ease-in-out forwards",       b: "gd-hit-b 0.5s ease-in-out forwards" },
  win:    { a: "gd-win-a 0.8s ease-in-out infinite",       b: "gd-win-b 0.8s ease-in-out infinite" },
  lose:   { a: "gd-lose-a 0.6s ease-in-out forwards",      b: "gd-lose-b 0.6s ease-in-out forwards" },
};

// ── Arena FX ──────────────────────────────────────────────────────────────────
function getOverlay(arenaRef) {
  if (!arenaRef.current) return null;
  let ov = arenaRef.current.querySelector("#gd-fx-overlay");
  if (!ov) { ov = document.createElement("div"); ov.id = "gd-fx-overlay"; ov.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:12;overflow:hidden;border-radius:12px"; arenaRef.current.appendChild(ov); }
  return ov;
}
function spawnFloat(ov, side, text, color, big) {
  if (!ov) return;
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;${side === "A" ? "left:16%" : "right:12%"};top:${big ? 8 : 12}px;font-size:${big ? 20 : 15}px;font-weight:700;color:${color};animation:gd-float 0.9s ease-out forwards;white-space:nowrap;font-family:system-ui,sans-serif`;
  el.textContent = text; ov.appendChild(el); setTimeout(() => el.remove(), 960);
}
function spawnEffect(ov, animType, atkIsA, col, emoji) {
  if (!ov) return;
  const side = atkIsA ? "left:20%" : "right:20%";
  if (animType === "proj") { const p = document.createElement("div"); p.style.cssText = `position:absolute;top:38%;${atkIsA?"left:20%":"right:20%"};font-size:17px;line-height:1;animation:${atkIsA?"gd-proj-r":"gd-proj-l"} 0.3s ease-in forwards`; p.textContent = emoji; ov.appendChild(p); setTimeout(() => p.remove(), 340); }
  if (animType === "burst") { for (let i = 0; i < 4; i++) { const r = document.createElement("div"); r.style.cssText = `position:absolute;top:45%;${side};width:14px;height:14px;border-radius:50%;border:2.5px solid ${col}`; r.animate([{transform:"translate(-50%,-50%) scale(0.15)",opacity:1},{transform:"translate(-50%,-50%) scale(4.5)",opacity:0}],{duration:430,delay:i*75,easing:"ease-out",fill:"forwards"}); ov.appendChild(r); setTimeout(() => r.remove(), 530+i*80); } }
  if (animType === "slash") { for (let i = 0; i < 3; i++) { const ang = atkIsA ? -32+i*14 : 32-i*14, lft = atkIsA ? 36+i*7 : 42+i*7; const s = document.createElement("div"); s.style.cssText = `position:absolute;top:${26+i*20}%;left:${lft}%;width:54px;height:3px;background:${col};border-radius:3px`; s.animate([{opacity:0,transform:`rotate(${ang}deg) scaleX(0)`},{opacity:1,transform:`rotate(${ang}deg) scaleX(1)`,offset:0.28},{opacity:0,transform:`rotate(${ang}deg) scaleX(1)`}],{duration:300,delay:i*65,easing:"ease-out",fill:"forwards"}); ov.appendChild(s); setTimeout(() => s.remove(), 430+i*70); } }
  if (animType === "slam") { const cx = atkIsA ? "57%" : "41%"; const w = document.createElement("div"); w.style.cssText = `position:absolute;top:47%;left:${cx};width:16px;height:16px;border-radius:50%;background:${col}`; w.animate([{transform:"translate(-50%,-50%) scale(0.3)",opacity:0.9},{transform:"translate(-50%,-50%) scale(7)",opacity:0}],{duration:400,easing:"ease-out",fill:"forwards"}); const fx = document.createElement("div"); fx.style.cssText = `position:absolute;top:30%;left:${atkIsA?"60%":"28%"};font-size:22px;line-height:1`; fx.textContent = "💥"; fx.animate([{opacity:0,transform:"scale(0.4)"},{opacity:1,transform:"scale(1.3)",offset:0.2},{opacity:0,transform:"scale(0.8)"}],{duration:370,easing:"ease-out",fill:"forwards"}); ov.appendChild(w); ov.appendChild(fx); setTimeout(() => { w.remove(); fx.remove(); }, 430); }
  if (animType === "cloud") { for (let i = 0; i < 7; i++) { const ang = (i/7)*Math.PI*2, tx = Math.cos(ang)*(atkIsA?52:-52), ty = Math.sin(ang)*28; const c = document.createElement("div"); c.style.cssText = `position:absolute;top:44%;${side};width:10px;height:10px;border-radius:50%;background:${col}`; c.animate([{transform:"translate(-50%,-50%) scale(0.3)",opacity:0.9},{transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(1.6)`,opacity:0.5,offset:0.6},{transform:`translate(calc(-50% + ${tx*1.5}px),calc(-50% + ${ty*1.5}px)) scale(2)`,opacity:0}],{duration:460,delay:i*38,easing:"ease-out",fill:"forwards"}); ov.appendChild(c); setTimeout(() => c.remove(), 560+i*42); } }
  if (animType === "aura") { for (let i = 0; i < 3; i++) { const r = document.createElement("div"); r.style.cssText = `position:absolute;top:44%;${side};width:18px;height:18px;border-radius:50%;border:2.5px solid ${col}`; r.animate([{transform:"translate(-50%,-50%) scale(0.4)",opacity:1},{transform:"translate(-50%,-50%) scale(3.2)",opacity:0}],{duration:440,delay:i*100,easing:"ease-out",fill:"forwards"}); ov.appendChild(r); setTimeout(() => r.remove(), 510+i*110); } }
}

// ── Challenge helpers ─────────────────────────────────────────────────────────
function encodeChallengeLink(name, plant) { const { image, ...rest } = plant; return btoa(unescape(encodeURIComponent(JSON.stringify({ n: name, p: rest, t: Date.now() })))); }
export function decodeChallengeLink(str) { try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; } }

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, dark }) {
  if (!status) return null;
  const def = STATUS_EFFECTS[status];
  if (!def) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: def.color, background: def.color + "22", padding: "2px 7px", borderRadius: 8, animation: "gd-status-pulse 1.5s infinite", display: "inline-block" }}>
      {def.emoji} {def.label}
    </span>
  );
}

// ── PP display ────────────────────────────────────────────────────────────────
function PPBar({ moves, ppState, dark }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {moves.map(m => {
        const used = ppState?.[m.name] || 0;
        const remaining = m.pp - used;
        const pct = remaining / m.pp;
        return (
          <div key={m.name} style={{ textAlign: "center", minWidth: 54 }}>
            <div style={{ fontSize: 8, color: dark ? "#5a7a5a" : "#888", marginBottom: 2, whiteSpace: "nowrap" }}>{m.name}</div>
            <div style={{ height: 4, background: dark ? "#2a3e2a" : "#e0e0e0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct * 100}%`, background: pct > 0.5 ? "#43a047" : pct > 0.2 ? "#f9a825" : "#e53935", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 8, color: dark ? "#5a7a5a" : "#aaa", marginTop: 1 }}>{remaining}/{m.pp}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fighter card ──────────────────────────────────────────────────────────────
function FighterCard({ plant, onSelect, selected, dark }) {
  const bs = getBattleStats(plant);
  const rarColor = { Common: "#78909c", Uncommon: "#43a047", Rare: "#1e88e5", Legendary: "#e65100" };
  const wins = plant.wins || 0, losses = plant.losses || 0;
  const moves = ATTACKS[plant.type] || ATTACKS.Other;
  return (
    <div onClick={() => onSelect(plant)} style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", border: `2px solid ${selected ? "#f9a825" : (dark ? "#2a3e2a" : "#c8e6c9")}`, background: selected ? (dark ? "#1e1a08" : "#fffde7") : (dark ? "#1a2a1c" : "#fffdf8"), transform: selected ? "scale(1.04)" : "scale(1)", transition: "all 0.2s", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ height: 80, background: dark ? "#0e1a0e" : "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {plant.image ? <img src={plant.image} alt={plant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 44 }}>{plant.emoji}</span>}
      </div>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{plant.name}</div>
        <div style={{ fontSize: 10, color: rarColor[plant.rarity] || "#888", marginBottom: 4 }}>{plant.rarity}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: dark ? "#5a7a5a" : "#888", marginBottom: 4 }}>
          <span>⚡{bs.attack}</span><span>🛡{bs.defense}</span><span>💨{bs.speed}</span>
        </div>
        <div style={{ fontSize: 8, color: dark ? "#3a5a3a" : "#bbb", overflow: "hidden", maxHeight: 14, lineHeight: "14px" }}>{moves.map(m => m.name).join(", ")}</div>
        {(wins + losses) > 0 && <div style={{ fontSize: 9, textAlign: "center", marginTop: 4, color: dark ? "#4a6a4a" : "#aaa" }}><span style={{ color: "#43a047" }}>W{wins}</span> <span style={{ color: "#e53935" }}>L{losses}</span></div>}
      </div>
    </div>
  );
}

// ── Rank strip (post-battle) ──────────────────────────────────────────────────
function RankStrip({ totalWins, prevWins, dark, rankedUp }) {
  const rank = getRank(totalWins), next = getNextRank(totalWins), progress = getProgressToNextRank(totalWins);
  const textSec = dark ? "#5a7a5a" : "#666";
  return (
    <div style={{ background: dark ? "#1a2a1c" : "#f0f7f0", border: `1px solid ${dark ? "#2a3e2a" : "#c8e6c9"}`, borderRadius: 10, padding: "9px 13px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: next ? 5 : 0 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{rank.badge}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: rank.color }}>{rank.title}</div>
          <div style={{ fontSize: 9, color: textSec }}>Rank {rank.rank} · {totalWins} wins</div>
        </div>
        {rankedUp && <span style={{ fontSize: 9, background: rank.color, color: "#fff", padding: "2px 8px", borderRadius: 10, animation: "gd-rankpop 0.5s ease-out" }}>Rank up!</span>}
      </div>
      {next && <>
        <div style={{ height: 4, background: dark ? "#2a2a2a" : "#e0e0e0", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: rank.color, borderRadius: 2, transition: "width 0.8s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 8, color: textSec }}>
          <span>{rank.badge} {rank.title}</span>
          <span>{next.winsNeeded - totalWins} wins → {next.badge} {next.title}</span>
        </div>
      </>}
    </div>
  );
}

// ── Challenge panel ───────────────────────────────────────────────────────────
function ChallengePanel({ plants, dark, onClose }) {
  const [champion, setChampion] = useState(null);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const bg = dark ? "#141f14" : "#fffdf8", textSec = dark ? "#5a7a5a" : "#666", border = dark ? "#2a3e2a" : "#e0e0e0", inputBg = dark ? "#0e160e" : "#f8f8f8";
  const generate = () => {
    if (!champion) return;
    const url = `${window.location.origin}${window.location.pathname}?challenge=${encodeChallengeLink(name.trim() || "A challenger", champion)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, background: bg, borderRadius: 24, border: `2px solid ${border}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg,#1565c0,#0d47a1)", padding: "15px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>⚔️ Challenge a Friend</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Pick your champion and send a battle link</div></div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ padding: "16px 18px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GardenLord_99" style={{ width: "100%", padding: "8px 11px", borderRadius: 10, border: `1.5px solid ${dark ? "#2a3e2a" : "#c8e6c9"}`, background: inputBg, color: dark ? "#c8e4c8" : "#333", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <label style={{ fontSize: 10, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>Champion{champion ? ` — ${champion.name}` : ""}</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8, marginBottom: 14 }}>
            {plants.map(p => <FighterCard key={p.id} plant={p} onSelect={setChampion} selected={champion?.id === p.id} dark={dark} />)}
          </div>
          <div style={{ background: dark ? "#1a2e1a" : "#e8f5e9", borderRadius: 10, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: dark ? "#7aaa7a" : "#2e7d32", lineHeight: 1.6 }}>
            Your friend opens the link, picks their plant, and the battle plays out. Full async challenges unlock with user accounts.
          </div>
          <button onClick={generate} disabled={!champion} style={{ width: "100%", padding: "11px 0", background: champion ? "linear-gradient(135deg,#1565c0,#0d47a1)" : (dark ? "#1e2e1e" : "#e0e0e0"), border: "none", borderRadius: 12, color: champion ? "#fff" : (dark ? "#4a5a4a" : "#aaa"), fontSize: 13, fontWeight: 700, cursor: champion ? "pointer" : "not-allowed" }}>
            {copied ? "✓ Link copied!" : "🔗 Copy Challenge Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Incoming challenge ────────────────────────────────────────────────────────
export function IncomingChallenge({ challenge, plants, onAccept, onDecline, dark }) {
  const [step, setStep] = useState("view");
  const [myPlant, setMyPlant] = useState(null);
  const bg = dark ? "#141f14" : "#fffdf8", textSec = dark ? "#5a7a5a" : "#666", border = dark ? "#2a3e2a" : "#e0e0e0";
  const challenger = challenge.p, bs = getBattleStats(challenger);
  const moves = ATTACKS[challenger.type] || ATTACKS.Other;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
      <div style={{ width: 420, background: bg, borderRadius: 24, border: "2.5px solid #1565c0", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg,#1565c0,#0d47a1)", padding: "18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 5 }}>Battle challenge!</div>
          <div style={{ fontSize: 26, marginBottom: 5 }}>{challenger.emoji}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{challenge.n} challenges you!</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>with {challenger.name} ({challenger.rarity})</div>
        </div>
        <div style={{ padding: "16px 18px 20px" }}>
          <div style={{ background: dark ? "#1a2a1c" : "#f0f7f0", borderRadius: 10, padding: "11px 13px", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 32 }}>{challenger.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a" }}>{challenger.name}</div>
                <div style={{ fontSize: 11, color: textSec, marginTop: 3 }}>⚡{bs.attack} · 🛡{bs.defense} · 💨{bs.speed} · ❤️{bs.hp}</div>
                <div style={{ fontSize: 9, color: textSec, marginTop: 2 }}>{moves.map(m => `${m.name} (${m.pp}PP)`).join(" · ")}</div>
              </div>
            </div>
          </div>
          {step === "view" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep("pick")} style={{ flex: 1, padding: "11px 0", background: "linear-gradient(135deg,#c62828,#b71c1c)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>⚔️ Accept</button>
              <button onClick={onDecline} style={{ padding: "11px 15px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${border}`, borderRadius: 12, color: textSec, fontSize: 12, cursor: "pointer" }}>Decline</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Pick your champion{myPlant ? ` — ${myPlant.name}` : ""}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(95px,1fr))", gap: 8, marginBottom: 12 }}>
                {plants.map(p => <FighterCard key={p.id} plant={p} onSelect={setMyPlant} selected={myPlant?.id === p.id} dark={dark} />)}
              </div>
              <button onClick={() => myPlant && onAccept(myPlant)} disabled={!myPlant} style={{ width: "100%", padding: "11px 0", background: myPlant ? "linear-gradient(135deg,#c62828,#b71c1c)" : (dark ? "#1e2e1e" : "#e0e0e0"), border: "none", borderRadius: 12, color: myPlant ? "#fff" : (dark ? "#4a5a4a" : "#aaa"), fontSize: 13, fontWeight: 800, cursor: myPlant ? "pointer" : "not-allowed" }}>
                {myPlant ? "⚔️ Fight!" : "Select your plant"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main BattleSystem ─────────────────────────────────────────────────────────
export default function BattleSystem({ plants, onUpdatePlant, onClose, dark, onRankUp, onAchievement, onBattleEnd, presetPlayer, presetOpponent }) {
  // Inject battle animations into <head> once, client-side only
  useEffect(() => {
    if (!document.getElementById("gd-battle-css")) {
      const s = document.createElement("style");
      s.id = "gd-battle-css";
      s.textContent = ANIM_CSS;
      document.head.appendChild(s);
    }
  }, []);

  const [phase, setPhase]           = useState(presetPlayer && presetOpponent ? "battle" : "select");
  const [playerPlant, setPlayerPlant]     = useState(presetPlayer || null);
  const [opponentPlant, setOpponentPlant] = useState(presetOpponent || null);
  const [battleLog, setBattleLog]   = useState([]);
  const [logIdx, setLogIdx]         = useState(0);
  const [hps, setHps]               = useState({ a: 0, b: 0, maxA: 0, maxB: 0 });
  const [statuses, setStatuses]     = useState({ a: null, b: null });
  const [ppState, setPpState]       = useState({ a: {}, b: {} });
  const [speed, setSpeed]           = useState(600);
  const [finished, setFinished]     = useState(false);
  const [animA, setAnimA]           = useState("idle");
  const [animB, setAnimB]           = useState("idle");
  const [arenaFlash, setArenaFlash] = useState("");
  const [prevTotalWins, setPrevTotalWins] = useState(0);
  const [rankedUp, setRankedUp]     = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showPP, setShowPP]         = useState(false);
  const [evolutionCelebration, setEvolutionCelebration] = useState(null); // { plant, stage }
  const timerRef  = useRef(null);
  const arenaRef  = useRef(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-start battle if both preset plants provided (daily challenge flow)
  useEffect(() => {
    if (presetPlayer && presetOpponent) {
      setTimeout(() => startBattle(presetPlayer, presetOpponent), 120);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = dark ? "#141f14" : "#fffdf8", textSec = dark ? "#5a7a5a" : "#666", border = dark ? "#2a3e2a" : "#e0e0e0";

  const triggerFX = useCallback((entry, atkIsA) => {
    const ov = getOverlay(arenaRef);
    const { move, missed, mult, dmg, newStatus } = entry;
    if (missed) {
      setAnimA(atkIsA ? "attack" : "idle"); setAnimB(atkIsA ? "idle" : "attack");
      setArenaFlash("");
      setTimeout(() => { spawnEffect(ov, move.anim, atkIsA, move.col, move.emoji); spawnFloat(ov, atkIsA ? "B" : "A", "Miss!", "#e53935", false); sndMiss(); }, 0);
    } else {
      setAnimA(atkIsA ? "attack" : "hit"); setAnimB(atkIsA ? "hit" : "attack");
      const flash = newStatus ? (newStatus === "poison" ? "p" : newStatus === "burn" ? "b" : "hit") : mult >= 2 ? "super" : "hit";
      setArenaFlash(flash);
      setTimeout(() => {
        spawnEffect(ov, move.anim, atkIsA, move.col, move.emoji);
        spawnFloat(ov, atkIsA ? "B" : "A", mult >= 2 ? `★ ${dmg}` : String(dmg), mult >= 2 ? "#e53935" : mult <= 0.5 ? "#78909c" : "#f9a825", mult >= 2);
        if (newStatus) setTimeout(() => spawnFloat(ov, atkIsA ? "B" : "A", STATUS_EFFECTS[newStatus]?.emoji + " " + newStatus, STATUS_EFFECTS[newStatus]?.color, false), 300);
        sndHit(mult);
        if (newStatus) setTimeout(sndStatus, 300);
      }, 0);
    }
    setTimeout(() => { setAnimA("idle"); setAnimB("idle"); setArenaFlash(""); }, 520);
  }, []);

  const triggerDotFX = useCallback((entry, isA) => {
    const ov = getOverlay(arenaRef);
    const def = STATUS_EFFECTS[entry.status];
    if (!def) return;
    setTimeout(() => { spawnFloat(ov, isA ? "A" : "B", `-${entry.damage} ${def.emoji}`, def.color, false); sndDot(); }, 0);
  }, []);

  const finishBattle = useCallback((log) => {
    setFinished(true);
    const result = log[log.length - 1];
    if (result?.type === "result") {
      const { winner, loser } = result;
      const playerWon = winner.id === playerPlant?.id;
      setAnimA(playerWon ? "win" : "lose"); setAnimB(playerWon ? "lose" : "win");
      playerWon ? sndVictory() : sndDefeat();

      // Evolution check — before updating wins so we can detect the threshold crossing
      const prevWins = winner.wins || 0;
      const newWins  = prevWins + 1;
      const prevStage = getEvolutionStage({ ...winner, wins: prevWins });
      const newStage  = getEvolutionStage({ ...winner, wins: newWins });
      const triggeredEvolution = newStage === 2 && prevStage === 1;
      const triggeredChampion  = newStage === 3 && prevStage === 2;

      const updatedWinner = { ...winner, wins: newWins };
      const updatedLoser  = { ...loser,  losses: (loser.losses || 0) + 1 };
      onUpdatePlant(updatedWinner);
      onUpdatePlant(updatedLoser);

      // Notify parent the battle ended (used by daily challenge)
      if (onBattleEnd) setTimeout(() => onBattleEnd(playerWon), 800);

      // Show evolution celebration
      if (triggeredEvolution || triggeredChampion) {
        setTimeout(() => {
          setEvolutionCelebration({ plant: updatedWinner, stage: newStage });
          if (triggeredChampion) sndRankUp();
        }, 1400);
      }

      // Rank up check
      const newTW = getTotalWins(plants) + (playerWon ? 1 : 0);
      if (getRank(newTW).rank > getRank(prevTotalWins).rank) {
        setRankedUp(true);
        setTimeout(() => { sndRankUp(); onRankUp?.(getRank(newTW)); }, 1100);
      }

      // Collect battle context for achievement checking
      if (onAchievement) {
        // Was the killing blow a DoT?
        const lastEvents = [...log].reverse();
        const killingEvent = lastEvents.find(e => e.type === "dot" || e.type === "attack");
        const dotKO  = killingEvent?.type === "dot";
        const dotType = dotKO ? killingEvent.status : null;
        // Was the killing blow super effective?
        const lastAttack = lastEvents.find(e => e.type === "attack" && !e.missed);
        const superEffectiveKO = !dotKO && lastAttack?.mult >= 2;
        // Collect all statuses the player applied this battle
        const statusesApplied = new Set(
          log
            .filter(e => e.type === "attack" && e.newStatus && e.atkId === playerPlant?.id)
            .map(e => e.newStatus)
        );
        onAchievement({
          playerWon,
          playerRarity:    playerPlant?.rarity,
          opponentRarity:  loser.rarity,
          totalWins:       newTW,
          rankReached:     getRank(newTW).rank,
          dotKO,
          dotType,
          superEffectiveKO,
          triggeredEvolution,
          triggeredChampion,
          statusesApplied,
        });
      }
    }
  }, [playerPlant, plants, prevTotalWins, onUpdatePlant, onRankUp, onAchievement, onBattleEnd]);

  const runTimer = useCallback((log, fromIdx) => {
    if (timerRef.current) clearInterval(timerRef.current);
    let idx = fromIdx;
    timerRef.current = setInterval(() => {
      idx++;
      if (idx >= log.length) { clearInterval(timerRef.current); timerRef.current = null; setLogIdx(log.length - 1); finishBattle(log); return; }
      const e = log[idx]; setLogIdx(idx);
      if (e?.type === "attack") {
        setHps(prev => ({ ...prev, a: e.aHp, b: e.bHp }));
        setStatuses({ a: e.statusA, b: e.statusB });
        if (e.newStatus) {
          if (e.defId === playerPlant?.id) setStatuses(prev => ({ ...prev, a: e.newStatus }));
          else setStatuses(prev => ({ ...prev, b: e.newStatus }));
        }
        setPpState(prev => {
          const isA = e.atkId === playerPlant?.id;
          const key = isA ? "a" : "b";
          return { ...prev, [key]: { ...prev[key], [e.move.name]: (prev[key][e.move.name] || 0) + 1 } };
        });
        triggerFX(e, e.atkId === playerPlant?.id);
      } else if (e?.type === "stunned") {
        setHps(prev => ({ ...prev, a: e.aHp, b: e.bHp }));
        const ov = getOverlay(arenaRef);
        const isA = e.name === playerPlant?.name;
        setTimeout(() => spawnFloat(ov, isA ? "A" : "B", "⚡ Stunned!", STATUS_EFFECTS.stun.color, false), 0);
      } else if (e?.type === "dot") {
        setHps(prev => ({ ...prev, a: e.aHp, b: e.bHp }));
        const isA = e.name === playerPlant?.name;
        triggerDotFX(e, isA);
      }
    }, speed);
  }, [speed, triggerFX, triggerDotFX, finishBattle, playerPlant]);

  const startBattle = useCallback((pP, pO) => {
    ac();
    if (!pP || !pO) return;
    setPrevTotalWins(getTotalWins(plants)); setRankedUp(false);
    const log = simulateBattle(pP, pO), intro = log[0];
    setBattleLog(log); setLogIdx(0);
    setHps({ a: intro.a.maxHp, b: intro.b.maxHp, maxA: intro.a.maxHp, maxB: intro.b.maxHp });
    setStatuses({ a: null, b: null });
    setPpState({ a: {}, b: {} });
    setFinished(false); setAnimA("idle"); setAnimB("idle"); setArenaFlash("");
    setPhase("battle");
    setTimeout(() => runTimer(log, 0), 50);
  }, [plants, runTimer]);

  const skipToEnd = () => {
    clearInterval(timerRef.current); timerRef.current = null;
    const atks = battleLog.filter(e => e.type === "attack"), last = atks[atks.length - 1];
    if (last) setHps(prev => ({ ...prev, a: last.aHp, b: last.bHp }));
    setLogIdx(battleLog.length - 1); finishBattle(battleLog);
  };

  const pauseResume = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    else runTimer(battleLog, logIdx);
  };

  const resetToSelect = () => {
    clearInterval(timerRef.current);
    setPhase("select"); setPlayerPlant(null); setOpponentPlant(null);
    setBattleLog([]); setLogIdx(0); setFinished(false);
    setAnimA("idle"); setAnimB("idle"); setRankedUp(false);
    setStatuses({ a: null, b: null }); setPpState({ a: {}, b: {} });
  };

  const pA = playerPlant, pB = opponentPlant;
  const intro = battleLog[0], curEntry = battleLog[logIdx];
  const pctA = Math.max(0, hps.a / hps.maxA), pctB = Math.max(0, hps.b / hps.maxB);
  const colA = pctA > 0.5 ? "#43a047" : pctA > 0.25 ? "#f9a825" : "#e53935";
  const colB = pctB > 0.5 ? "#43a047" : pctB > 0.25 ? "#f9a825" : "#e53935";
  const result = finished ? battleLog[battleLog.length - 1] : null;
  const winner = result?.winner;
  const totalWins = getTotalWins(plants);
  const aA = SPRITE_ANIM[animA]?.a || SPRITE_ANIM.idle.a;
  const aB = SPRITE_ANIM[animB]?.b || SPRITE_ANIM.idle.b;
  const arenaAnim = arenaFlash === "super" ? "gd-flash-s 0.45s ease-out" : arenaFlash === "hit" ? "gd-flash-r 0.45s ease-out" : arenaFlash === "p" ? "gd-flash-p 0.45s ease-out" : arenaFlash === "b" ? "gd-flash-b 0.45s ease-out" : "none";

  // ── SELECT ──
  if (phase === "select") return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ width: 580, maxHeight: "90vh", overflowY: "auto", background: bg, borderRadius: 24, border: `2px solid ${border}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#b71c1c,#c62828)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>⚔️ Plant Battle Arena</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{getRank(totalWins).badge} {getRank(totalWins).title} · {totalWins} wins</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowChallenge(true)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "6px 12px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700 }}>🔗 Challenge</button>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          </div>
          <div style={{ padding: "16px 18px 22px" }}>
            <div style={{ background: dark ? "#1a2e1a" : "#e8f5e9", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: dark ? "#7aaa7a" : "#2e7d32", fontWeight: 600 }}>
              Type matchups: 2x / 0.5x · Speed affects miss chance (5–28%) · Moves have limited PP · Status effects: 🔥Burn · ☠️Poison · ⚡Stun · 🌿Root
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Your Fighter{pA ? ` — ${pA.name}` : ""}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                  {plants.filter(p => p.id !== opponentPlant?.id).map(p => <FighterCard key={p.id} plant={p} onSelect={setPlayerPlant} selected={playerPlant?.id === p.id} dark={dark} />)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Opponent{pB ? ` — ${pB.name}` : ""}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                  {plants.filter(p => p.id !== playerPlant?.id).map(p => <FighterCard key={p.id} plant={p} onSelect={setOpponentPlant} selected={opponentPlant?.id === p.id} dark={dark} />)}
                </div>
              </div>
            </div>
            <button onClick={() => { if (playerPlant && opponentPlant && playerPlant.id !== opponentPlant.id) startBattle(playerPlant, opponentPlant); }} disabled={!playerPlant || !opponentPlant || playerPlant?.id === opponentPlant?.id}
              style={{ width: "100%", padding: "12px 0", background: playerPlant && opponentPlant && playerPlant.id !== opponentPlant.id ? "linear-gradient(135deg,#c62828,#b71c1c)" : (dark ? "#2a2a2a" : "#e0e0e0"), border: "none", borderRadius: 12, color: playerPlant && opponentPlant ? "#fff" : (dark ? "#4a4a4a" : "#aaa"), fontSize: 14, fontWeight: 800, cursor: playerPlant && opponentPlant ? "pointer" : "not-allowed" }}>
              {!playerPlant ? "Select your fighter" : !opponentPlant ? "Select an opponent" : "⚔️ BATTLE!"}
            </button>
          </div>
        </div>
      </div>
      {showChallenge && <ChallengePanel plants={plants} dark={dark} onClose={() => setShowChallenge(false)} />}
    </>
  );

  // ── BATTLE ──
  let centreHTML = null;
  if (!finished) {
    if (logIdx === 0 && intro) {
      centreHTML = <div style={{ fontSize: 11, color: textSec, textAlign: "center" }}>{intro.first} strikes first!</div>;
    } else if (curEntry?.type === "stunned") {
      centreHTML = <div style={{ textAlign: "center" }}><div style={{ fontSize: 24 }}>⚡</div><div style={{ fontSize: 12, fontWeight: 700, color: STATUS_EFFECTS.stun.color }}>Stunned! {curEntry.name} loses a turn</div></div>;
    } else if (curEntry?.type === "dot") {
      const def = STATUS_EFFECTS[curEntry.status];
      centreHTML = <div style={{ textAlign: "center" }}><div style={{ fontSize: 24 }}>{def?.emoji}</div><div style={{ fontSize: 12, fontWeight: 700, color: def?.color }}>{curEntry.name} takes {curEntry.damage} {def?.label} damage</div></div>;
    } else if (curEntry?.type === "attack") {
      const mv = curEntry.move || {};
      centreHTML = (
        <div style={{ textAlign: "center", padding: "0 4px" }}>
          <div style={{ fontSize: 10, color: textSec, marginBottom: 2 }}>{curEntry.atkEmoji} {curEntry.atkName} uses</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: mv.col || "inherit", marginBottom: 3 }}>{mv.name}</div>
          {curEntry.missed
            ? <div style={{ fontSize: 13, color: "#e53935", fontWeight: 700 }}>Missed!</div>
            : <div style={{ fontSize: 11, color: textSec }}>
                {curEntry.mult >= 2 && <span style={{ color: "#e53935", fontWeight: 700 }}>Super effective! </span>}
                {curEntry.mult <= 0.5 && <span style={{ color: "#78909c" }}>Not very effective. </span>}
                <span style={{ color: curEntry.mult >= 2 ? "#e53935" : "#43a047", fontWeight: 700, fontSize: 14 }}>{curEntry.dmg} dmg</span>
                {curEntry.newStatus && <div style={{ marginTop: 2, fontSize: 11 }}>{STATUS_EFFECTS[curEntry.newStatus]?.emoji} {curEntry.newStatus} applied!</div>}
              </div>
          }
        </div>
      );
    }
  } else {
    const isWin = winner?.id === pA?.id;
    centreHTML = <div style={{ textAlign: "center" }}><div style={{ fontSize: 36, marginBottom: 3 }}>{winner?.emoji}</div><div style={{ fontSize: 13, fontWeight: 800, color: isWin ? "#43a047" : "#e53935" }}>{isWin ? "Victory!" : "Defeat!"}</div><div style={{ fontSize: 11, color: textSec, marginTop: 2 }}>{winner?.name} wins!</div></div>;
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ width: 500, background: bg, borderRadius: 24, border: `2px solid ${dark ? "#3a0000" : "#ffcdd2"}`, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg,#b71c1c,#880e4f)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>⚔️ {pA?.name} vs {pB?.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowPP(p => !p)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>PP {showPP ? "▲" : "▼"}</button>
            <select value={speed} onChange={e => { setSpeed(Number(e.target.value)); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; setTimeout(() => runTimer(battleLog, logIdx), 0); } }} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer" }}>
              <option value={1000}>🐢 Slow</option>
              <option value={600}>⚡ Normal</option>
              <option value={200}>🚀 Fast</option>
            </select>
          </div>
        </div>

        <div style={{ padding: "12px 16px" }}>
          {/* HP bars with status badges */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 9, alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3, alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a" }}>{pA?.name}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <StatusBadge status={statuses.a} dark={dark} />
                  <span style={{ color: colA, fontWeight: 700 }}>{hps.a}/{hps.maxA}</span>
                </div>
              </div>
              <div style={{ height: 9, background: dark ? "#2a3e2a" : "#e8e8e8", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(pctA * 100)}%`, background: colA, borderRadius: 5, transition: "width 0.35s ease" }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: textSec, fontWeight: 700 }}>vs</div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: colB, fontWeight: 700 }}>{hps.b}/{hps.maxB}</span>
                  <StatusBadge status={statuses.b} dark={dark} />
                </div>
                <span style={{ fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a" }}>{pB?.name}</span>
              </div>
              <div style={{ height: 9, background: dark ? "#2a3e2a" : "#e8e8e8", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(pctB * 100)}%`, background: colB, borderRadius: 5, transition: "width 0.35s ease" }} />
              </div>
            </div>
          </div>

          {/* PP display */}
          {showPP && pA && pB && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8, background: dark ? "#0e160e" : "#f5f5f5", borderRadius: 10, padding: "8px 10px" }}>
              <div><div style={{ fontSize: 9, color: textSec, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{pA.name}</div><PPBar moves={ATTACKS[pA.type] || ATTACKS.Other} ppState={ppState.a} dark={dark} /></div>
              <div><div style={{ fontSize: 9, color: textSec, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{pB.name}</div><PPBar moves={ATTACKS[pB.type] || ATTACKS.Other} ppState={ppState.b} dark={dark} /></div>
            </div>
          )}

          {/* Arena */}
          <div ref={arenaRef} style={{ position: "relative", background: dark ? "#0e1a0e" : "#f8fdf8", border: `1px solid ${border}`, borderRadius: 14, padding: "12px 8px", marginBottom: 8, height: 140, display: "flex", alignItems: "center", justifyContent: "space-between", overflow: "hidden", animation: arenaAnim }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ fontSize: 56, lineHeight: 1, animation: aA }}>{pA?.image ? <img src={pA.image} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} /> : pA?.emoji}</div>
              <div style={{ fontSize: 9, color: textSec }}>{pA?.type}</div>
            </div>
            <div style={{ flex: "0 0 138px" }}>{centreHTML}</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ fontSize: 56, lineHeight: 1, animation: aB }}>{pB?.image ? <img src={pB.image} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, transform: "scaleX(-1)" }} /> : pB?.emoji}</div>
              <div style={{ fontSize: 9, color: textSec }}>{pB?.type}</div>
            </div>
          </div>

          {/* Rank strip post-battle */}
          {finished && <RankStrip totalWins={getTotalWins(plants)} prevWins={prevTotalWins} dark={dark} rankedUp={rankedUp} />}

          {/* Battle log */}
          <div style={{ background: dark ? "#0a140a" : "#f5f5f5", borderRadius: 10, padding: "7px 10px", marginBottom: 8, height: 66, overflowY: "auto", fontSize: 11, color: textSec, fontFamily: "monospace" }}>
            {battleLog.slice(1, logIdx + 1).length === 0
              ? <div style={{ textAlign: "center", paddingTop: 18 }}>Battle log...</div>
              : battleLog.slice(1, logIdx + 1).map((e, i) => {
                  if (e.type === "attack") return <div key={i} style={{ padding: "1px 0", borderBottom: `1px solid ${border}` }}>{e.atkEmoji} <strong>{e.atkName}</strong> uses <em>{e.move?.name}</em> {e.missed ? "— missed!" : `→ ${e.dmg} dmg`}{e.newStatus ? ` + ${STATUS_EFFECTS[e.newStatus]?.emoji}` : ""}{e.mult >= 2 ? " ★" : e.mult <= 0.5 ? " (weak)" : ""}</div>;
                  if (e.type === "stunned") return <div key={i} style={{ padding: "1px 0", borderBottom: `1px solid ${border}`, color: STATUS_EFFECTS.stun.color }}>⚡ {e.name} is stunned and loses a turn!</div>;
                  if (e.type === "dot") { const def = STATUS_EFFECTS[e.status]; return <div key={i} style={{ padding: "1px 0", borderBottom: `1px solid ${border}`, color: def?.color }}>{def?.emoji} {e.name} takes {e.damage} {e.status} damage</div>; }
                  return null;
                })
            }
          </div>

          {/* Controls */}
          {finished ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { if (playerPlant && opponentPlant) startBattle(playerPlant, opponentPlant); }} disabled={!playerPlant || !opponentPlant} style={{ flex: 1, padding: "10px 0", background: "linear-gradient(135deg,#c62828,#b71c1c)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>⚔️ Rematch</button>
              <button onClick={resetToSelect} style={{ padding: "10px 14px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${border}`, borderRadius: 12, color: textSec, fontSize: 12, cursor: "pointer" }}>Change</button>
              <button onClick={onClose} style={{ padding: "10px 14px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${border}`, borderRadius: 12, color: textSec, fontSize: 12, cursor: "pointer" }}>Done</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={pauseResume} style={{ padding: "8px 20px", background: dark ? "#1a2e1a" : "#e8f5e9", border: `1px solid ${dark ? "#2a3e2a" : "#c8e6c9"}`, borderRadius: 10, color: dark ? "#7aaa7a" : "#2e7d32", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {timerRef.current ? "⏸ Pause" : "▶ Resume"}
              </button>
              <button onClick={skipToEnd} style={{ padding: "8px 20px", background: dark ? "#1e1a08" : "#fff8e1", border: `1px solid ${dark ? "#4a3a00" : "#ffe082"}`, borderRadius: 10, color: dark ? "#c8a020" : "#f57c00", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>⏭ Skip</button>
            </div>
          )}
        </div>
      </div>

      {/* Evolution celebration overlay */}
      {evolutionCelebration && (() => {
        const { plant, stage } = evolutionCelebration;
        const cfg = EVOLUTION_CONFIG[stage];
        const col = stage === 3 ? "#e65100" : "#f9a825";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }} onClick={() => setEvolutionCelebration(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width: 320, background: dark ? "#141f14" : "#fffdf8", borderRadius: 24, border: `3px solid ${col}`, boxShadow: `0 0 60px ${col}66`, fontFamily: "system-ui,sans-serif", overflow: "hidden", textAlign: "center" }}>
              <div style={{ background: `linear-gradient(135deg,${col},${col}88)`, padding: "24px 20px 20px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
                  {stage === 3 ? "Champion Form!" : "Evolution!"}
                </div>
                <div style={{ fontSize: 64, marginBottom: 8, animation: "gd-rankpop 0.6s ease-out", lineHeight: 1 }}>{plant.emoji}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{plant.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>
                  {cfg.badge} Stage {stage} — {stage === 3 ? "+20% all stats" : "+10% all stats"}
                </div>
              </div>
              <div style={{ padding: "16px 20px 20px" }}>
                <div style={{ fontSize: 12, color: dark ? "#7aaa7a" : "#555", marginBottom: 14, lineHeight: 1.6 }}>
                  {stage === 3 ? `${plant.name} has reached Champion Form. Stats permanently boosted 20%.` : `${plant.name} evolved! Stats boosted 10%. Reach 25 wins for Champion Form.`}
                </div>
                <button onClick={() => setEvolutionCelebration(null)} style={{ width: "100%", padding: "12px 0", background: `linear-gradient(135deg,${col},${col}88)`, border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  {cfg.badge} Awesome!
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
