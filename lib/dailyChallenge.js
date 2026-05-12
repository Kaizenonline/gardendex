// lib/dailyChallenge.js
// Generates a seeded daily opponent and tracks the player's daily challenge streak.
// One challenge per calendar day — resets at midnight local time.

const STORAGE_KEY = "gardendex_daily_challenge";

/**
 * Simple seeded random — same date always picks the same opponent.
 * seed: string (e.g. "2025-05-04")
 */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) / 0xffffffff);
}

/** Today's date string — used as both the seed and the storage key */
export function todayKey() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

/** Pick today's opponent from a list of plants */
export function getDailyOpponent(plants) {
  if (!plants || plants.length === 0) return null;
  const rng = seededRandom(todayKey() + plants.length);
  return plants[Math.floor(rng * plants.length)];
}

/** Load state from localStorage */
export function loadDailyState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/** Save state to localStorage */
export function saveDailyState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

/**
 * Get today's full challenge state, accounting for streak continuity.
 * Returns { date, completed, playerWon, streak, opponentId }
 */
export function getDailyState(plants) {
  const today = todayKey();
  const saved = loadDailyState();

  // Check if yesterday's challenge was completed (for streak continuity)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString("en-CA");

  const prevStreak = saved?.date === yesterdayKey && saved?.completed ? (saved.streak || 1) : 0;

  if (saved?.date === today) {
    return saved; // today's state already exists
  }

  // New day — create fresh state
  const opponent = getDailyOpponent(plants);
  const fresh = {
    date:       today,
    completed:  false,
    playerWon:  null,
    streak:     prevStreak,
    opponentId: opponent?.id || null,
  };
  saveDailyState(fresh);
  return fresh;
}

/** Mark the challenge as completed */
export function completeDailyChallenge(state, playerWon) {
  const newState = {
    ...state,
    completed: true,
    playerWon,
    streak: playerWon ? (state.streak || 0) + 1 : 0,
  };
  saveDailyState(newState);
  return newState;
}
