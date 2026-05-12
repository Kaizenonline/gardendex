// lib/ranks.js
// Rank definitions and utility functions.
// Shared between frontend components and potentially API routes.

export const RANKS = [
  { rank: 1,  winsNeeded: 0,   title: "Seedling Scout",           badge: "🌱", color: "#78909c", description: "Every journey begins with a single sprout." },
  { rank: 2,  winsNeeded: 20,  title: "Apprentice Composter",     badge: "🪱", color: "#8d6e63", description: "You've learned that great gardens start from the ground up." },
  { rank: 3,  winsNeeded: 40,  title: "Lord Compost",             badge: "💩", color: "#6d4c41", description: "Feared by plants everywhere. Respected by none." },
  { rank: 4,  winsNeeded: 60,  title: "Thorn Bearer",             badge: "🌵", color: "#558b2f", description: "You've grown sharp edges. Opponents approach with caution." },
  { rank: 5,  winsNeeded: 80,  title: "Keeper of the Roots",      badge: "🌿", color: "#2e7d32", description: "Your connection to the soil runs deep." },
  { rank: 6,  winsNeeded: 100, title: "Champion of the Forest",   badge: "🌳", color: "#1b5e20", description: "The trees bow. The undergrowth parts. You have arrived." },
  { rank: 7,  winsNeeded: 120, title: "High Pruner of the Vale",  badge: "✂️", color: "#00695c", description: "You shape the garden with ruthless precision." },
  { rank: 8,  winsNeeded: 140, title: "Warden of the Undergrowth",badge: "🍄", color: "#4a148c", description: "Ancient forces stir beneath your boots. They answer to you." },
  { rank: 9,  winsNeeded: 160, title: "Grand Botanist Supreme",   badge: "🔬", color: "#1a237e", description: "Science and nature bend to your will in equal measure." },
  { rank: 10, winsNeeded: 180, title: "The Eternal Bloom",        badge: "🌸", color: "#880e4f", description: "You are beyond rank. You are beyond season. You simply are." },
];

export function getRank(totalWins) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (totalWins >= r.winsNeeded) current = r;
    else break;
  }
  return current;
}

export function getNextRank(totalWins) {
  const current = getRank(totalWins);
  return RANKS.find(r => r.rank === current.rank + 1) || null;
}

export function getProgressToNextRank(totalWins) {
  const current = getRank(totalWins);
  const next = getNextRank(totalWins);
  if (!next) return 1; // max rank
  const winsIntoThisRank = totalWins - current.winsNeeded;
  const winsNeededForNext = next.winsNeeded - current.winsNeeded;
  return winsIntoThisRank / winsNeededForNext;
}

export function getTotalWins(plants) {
  return plants.reduce((sum, p) => sum + (p.wins || 0), 0);
}
