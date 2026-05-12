// lib/attacks.js
// Type-specific move pools. Each move has:
//   name, anim, emoji, col — for display and visuals
//   pp    — power points (max uses per battle)
//   power — base power multiplier (1.0 = normal, 1.3 = strong, 0.8 = weak but reliable)
//   status — optional status effect applied on hit: "burn"|"poison"|"stun"|"root"
//   statusChance — 0–100 % chance to apply status on a non-miss hit

export const ATTACKS = {
  Vegetable: [
    { name: "Seed Spit",    anim: "proj",  emoji: "🌰", col: "#33691e", pp: 10, power: 1.0 },
    { name: "Root Slam",    anim: "slam",  emoji: "💥", col: "#2e7d32", pp: 6,  power: 1.3, status: "root",   statusChance: 40 },
    { name: "Vine Whip",    anim: "slash", emoji: "🌿", col: "#43a047", pp: 8,  power: 0.9 },
  ],
  Fruit: [
    { name: "Juice Burst",  anim: "burst", emoji: "💦", col: "#e65100", pp: 10, power: 1.0 },
    { name: "Pit Hurl",     anim: "proj",  emoji: "🟤", col: "#bf360c", pp: 8,  power: 1.1 },
    { name: "Sugar Rush",   anim: "aura",  emoji: "✨", col: "#ff6f00", pp: 5,  power: 1.4, status: "stun",   statusChance: 25 },
  ],
  Herb: [
    { name: "Pollen Cloud", anim: "cloud", emoji: "🌼", col: "#7b1fa2", pp: 8,  power: 0.9, status: "poison", statusChance: 60 },
    { name: "Aroma Blast",  anim: "burst", emoji: "💨", col: "#6a1b9a", pp: 10, power: 1.0 },
    { name: "Spore Surge",  anim: "proj",  emoji: "🟣", col: "#4a148c", pp: 6,  power: 1.2, status: "poison", statusChance: 30 },
  ],
  Flower: [
    { name: "Petal Fury",   anim: "slash", emoji: "🌸", col: "#c2185b", pp: 8,  power: 1.1 },
    { name: "Thorn Lash",   anim: "slash", emoji: "🌹", col: "#880e4f", pp: 10, power: 0.9, status: "burn",   statusChance: 30 },
    { name: "Bloom Burst",  anim: "burst", emoji: "🌺", col: "#ad1457", pp: 5,  power: 1.5 },
  ],
  Succulent: [
    { name: "Spine Jab",    anim: "proj",  emoji: "📍", col: "#558b2f", pp: 12, power: 0.85 },
    { name: "Desert Dust",  anim: "cloud", emoji: "🌪️", col: "#827717", pp: 8,  power: 0.9,  status: "stun",   statusChance: 35 },
    { name: "Wax Guard",    anim: "aura",  emoji: "🛡️", col: "#33691e", pp: 6,  power: 0.7 },
  ],
  Tree: [
    { name: "Branch Bash",  anim: "slam",  emoji: "🪵", col: "#5d4037", pp: 6,  power: 1.4 },
    { name: "Leaf Storm",   anim: "cloud", emoji: "🍃", col: "#33691e", pp: 10, power: 1.0 },
    { name: "Sap Splash",   anim: "burst", emoji: "🟡", col: "#795548", pp: 8,  power: 0.9,  status: "root",   statusChance: 40 },
  ],
  Grass: [
    { name: "Razor Blade",  anim: "slash", emoji: "⚡", col: "#2e7d32", pp: 10, power: 1.0 },
    { name: "Wind Slash",   anim: "slash", emoji: "💨", col: "#388e3c", pp: 8,  power: 1.1 },
    { name: "Creep Bind",   anim: "slam",  emoji: "🌱", col: "#1b5e20", pp: 6,  power: 1.2,  status: "root",   statusChance: 50 },
  ],
  Other: [
    { name: "Wild Growth",  anim: "burst", emoji: "🌿", col: "#455a64", pp: 10, power: 1.0 },
    { name: "Nature Wrath", anim: "slam",  emoji: "💥", col: "#37474f", pp: 6,  power: 1.3 },
    { name: "Spore Bomb",   anim: "cloud", emoji: "🟢", col: "#546e7a", pp: 8,  power: 1.0,  status: "poison", statusChance: 40 },
  ],
};

// STATUS EFFECTS
// burn   — deals % of max HP per turn (fire damage)
// poison — stacking damage over time
// stun   — 40% chance to skip turn
// root   — reduces speed by 50% (affects who goes first)
export const STATUS_EFFECTS = {
  burn:   { label: "Burned",   emoji: "🔥", color: "#e64a19", dot: 0.06, dotLabel: "6% max HP/turn" },
  poison: { label: "Poisoned", emoji: "☠️", color: "#7b1fa2", dot: 0.04, stacking: true, dotLabel: "stacking 4%/turn" },
  stun:   { label: "Stunned",  emoji: "⚡", color: "#f9a825", skipChance: 0.40, dotLabel: "40% skip turn" },
  root:   { label: "Rooted",   emoji: "🌿", color: "#2e7d32", speedMult: 0.5, dotLabel: "50% speed" },
};

/** Pick a random move from the pool that still has PP remaining */
export function pickAttack(type, ppState) {
  const pool = (ATTACKS[type] || ATTACKS.Other).filter(m => {
    const used = ppState?.[m.name] || 0;
    return used < m.pp;
  });
  // If all moves are out of PP, allow any move (struggle)
  const available = pool.length > 0 ? pool : ATTACKS[type] || ATTACKS.Other;
  return available[Math.floor(Math.random() * available.length)];
}

/** Returns true if this hit should miss */
export function rolledMiss(attackerSpeed, defenderSpeed) {
  const chance = Math.max(5, Math.min(28, 12 - (attackerSpeed - defenderSpeed) * 0.2));
  return Math.random() * 100 < chance;
}

/** Apply status from a move hit — returns the new status or null */
export function rollStatus(move, currentStatus) {
  if (!move.status || !move.statusChance) return null;
  // Don't overwrite existing status (first one sticks, except poison which stacks)
  if (currentStatus && currentStatus !== "poison") return null;
  if (Math.random() * 100 < move.statusChance) return move.status;
  return null;
}

/** Apply end-of-turn status damage — returns { damage, newPoisonStacks } */
export function applyStatusDot(hp, maxHp, status, poisonStacks = 1) {
  if (!status) return { damage: 0, newPoisonStacks: poisonStacks };
  const def = STATUS_EFFECTS[status];
  if (!def) return { damage: 0, newPoisonStacks: poisonStacks };
  let damage = 0;
  let newPoisonStacks = poisonStacks;
  if (status === "burn")   damage = Math.round(maxHp * def.dot);
  if (status === "poison") { damage = Math.round(maxHp * def.dot * poisonStacks); newPoisonStacks = Math.min(poisonStacks + 1, 5); }
  return { damage: Math.max(1, damage), newPoisonStacks };
}

/** Returns true if stun causes the attacker to skip this turn */
export function rolledStunSkip(status) {
  if (status !== "stun") return false;
  return Math.random() < STATUS_EFFECTS.stun.skipChance;
}
