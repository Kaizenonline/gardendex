// lib/achievements.js
// Achievement definitions and checking logic.
// Achievements are checked after every battle result.

export const ACHIEVEMENTS = [
  // ── Battle milestones ───────────────────────────────────────────────────────
  {
    id: "first_win",
    title: "First Blood",
    description: "Win your very first battle",
    emoji: "🌱",
    rarity: "Common",
    check: ({ totalWins }) => totalWins >= 1,
  },
  {
    id: "hat_trick",
    title: "Hat Trick",
    description: "Win 3 battles in a row",
    emoji: "🔥",
    rarity: "Common",
    check: ({ streak }) => streak >= 3,
  },
  {
    id: "on_a_roll",
    title: "On A Roll",
    description: "Win 5 battles in a row",
    emoji: "⚡",
    rarity: "Uncommon",
    check: ({ streak }) => streak >= 5,
  },
  {
    id: "unstoppable",
    title: "Unstoppable",
    description: "Win 10 battles in a row",
    emoji: "💥",
    rarity: "Rare",
    check: ({ streak }) => streak >= 10,
  },
  {
    id: "centurion",
    title: "Centurion",
    description: "Win 100 total battles",
    emoji: "💯",
    rarity: "Rare",
    check: ({ totalWins }) => totalWins >= 100,
  },

  // ── Plant-specific ──────────────────────────────────────────────────────────
  {
    id: "giant_slayer",
    title: "Giant Slayer",
    description: "Defeat a Legendary plant",
    emoji: "⚔️",
    rarity: "Uncommon",
    check: ({ opponentRarity, playerWon }) => playerWon && opponentRarity === "Legendary",
  },
  {
    id: "underdog",
    title: "Underdog",
    description: "Win with a Common plant against a Legendary",
    emoji: "🐛",
    rarity: "Rare",
    check: ({ playerRarity, opponentRarity, playerWon }) =>
      playerWon && playerRarity === "Common" && opponentRarity === "Legendary",
  },
  {
    id: "type_specialist",
    title: "Type Specialist",
    description: "Win a super effective battle (2× damage move dealt final blow)",
    emoji: "🎯",
    rarity: "Common",
    check: ({ superEffectiveKO }) => superEffectiveKO,
  },

  // ── Status effects ──────────────────────────────────────────────────────────
  {
    id: "toxic_victory",
    title: "Toxic Victory",
    description: "Win a battle where the opponent is killed by poison DoT",
    emoji: "☠️",
    rarity: "Uncommon",
    check: ({ dotKO, dotType }) => dotKO && dotType === "poison",
  },
  {
    id: "burn_it_down",
    title: "Burn It Down",
    description: "Win a battle where the opponent is killed by burn DoT",
    emoji: "🔥",
    rarity: "Uncommon",
    check: ({ dotKO, dotType }) => dotKO && dotType === "burn",
  },
  {
    id: "status_collector",
    title: "Status Collector",
    description: "Apply all 4 status effects across your battles",
    emoji: "🌈",
    rarity: "Rare",
    check: ({ allStatuses }) =>
      allStatuses?.has("burn") && allStatuses?.has("poison") &&
      allStatuses?.has("stun") && allStatuses?.has("root"),
  },

  // ── Evolution ───────────────────────────────────────────────────────────────
  {
    id: "first_evolution",
    title: "Blooming!",
    description: "Evolve a plant for the first time (10 wins with one plant)",
    emoji: "✨",
    rarity: "Uncommon",
    check: ({ triggeredEvolution }) => triggeredEvolution,
  },
  {
    id: "champion_evolution",
    title: "Champion Form",
    description: "Reach Stage 3 with any plant (25 wins)",
    emoji: "🌟",
    rarity: "Legendary",
    check: ({ triggeredChampion }) => triggeredChampion,
  },

  // ── Tournament ──────────────────────────────────────────────────────────────
  {
    id: "tournament_victor",
    title: "Tournament Victor",
    description: "Win a tournament",
    emoji: "🏆",
    rarity: "Rare",
    check: ({ wonTournament }) => wonTournament,
  },
  {
    id: "rank_champion",
    title: "Champion of the Forest",
    description: "Reach Rank 6",
    emoji: "🌳",
    rarity: "Uncommon",
    check: ({ rankReached }) => rankReached >= 6,
  },
  {
    id: "eternal_bloom",
    title: "The Eternal Bloom",
    description: "Reach the maximum rank — Rank 10",
    emoji: "🌸",
    rarity: "Legendary",
    check: ({ rankReached }) => rankReached >= 10,
  },
];

export const RARITY_COLOR = {
  Common:    "#78909c",
  Uncommon:  "#43a047",
  Rare:      "#1e88e5",
  Legendary: "#e65100",
};

/** Load achievements from localStorage */
export function loadAchievements() {
  try { return JSON.parse(localStorage.getItem("gardendex_achievements") || "{}"); } catch { return {}; }
}

/** Save achievements to localStorage */
export function saveAchievements(a) {
  try { localStorage.setItem("gardendex_achievements", JSON.stringify(a)); } catch {}
}

/** Load win streak */
export function loadStreak() {
  try { return parseInt(localStorage.getItem("gardendex_streak") || "0", 10); } catch { return 0; }
}

/** Save win streak */
export function saveStreak(n) {
  try { localStorage.setItem("gardendex_streak", String(n)); } catch {}
}

/** Load set of statuses ever applied */
export function loadAllStatuses() {
  try { return new Set(JSON.parse(localStorage.getItem("gardendex_statuses") || "[]")); } catch { return new Set(); }
}

export function saveAllStatuses(s) {
  try { localStorage.setItem("gardendex_statuses", JSON.stringify([...s])); } catch {}
}

/**
 * Check all achievements after a battle.
 * Returns array of newly unlocked achievement objects.
 */
export function checkAchievements(context, existing) {
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (existing[ach.id]) continue; // already unlocked
    try {
      if (ach.check(context)) {
        newlyUnlocked.push(ach);
      }
    } catch (e) {
      // Fix #8: don't swallow silently — a broken check should be visible in logs
      console.warn(`[achievements] check failed for "${ach.id}":`, e.message);
    }
  }
  return newlyUnlocked;
}

/** Derive evolution stage purely from win count — no stored field needed */
export function getEvolutionStage(plant) {
  const w = plant.wins || 0;
  if (w >= 25) return 3;
  if (w >= 10) return 2;
  return 1;
}

export const EVOLUTION_CONFIG = {
  1: { label: null,          badge: null,      statMult: 1.0,  glow: "none" },
  2: { label: "Evolved",     badge: "✨",       statMult: 1.10, glow: "0 0 16px #ffd54f88" },
  3: { label: "Champion",    badge: "🌟",       statMult: 1.20, glow: "0 0 24px #e6510088" },
};
