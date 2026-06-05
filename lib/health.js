// lib/health.js
// Plant health score system — decays over time without care, recovers with journal entries.
// Health is computed on the fly from journal history; never stored directly.

// Max days before health starts dropping
const GRACE_DAYS = 3;
// Days until health hits zero from last care event
const DECAY_DAYS = 14;

// Journal entry types that count as "care"
const CARE_TYPES = new Set(["water", "feed", "prune"]);

/**
 * Returns a health score 0–100 for a plant.
 * Based on: last care journal entry, nextCareDate, and time elapsed.
 */
export function getHealthScore(plant) {
  const journal = plant.journal || [];
  const careEntries = journal.filter(e => CARE_TYPES.has(e.type));

  // Normalize: journal entries may use `timestamp`, `ts`, or `date` depending
  // on when they were written. Always resolve to a single string. (Fix #7)
  const getTs = e => e.timestamp ?? e.ts ?? e.date ?? null;

  // Find the most recent care event timestamp
  let lastCareTs = null;
  if (careEntries.length > 0) {
    lastCareTs = careEntries.reduce((latest, e) => {
      const ts = getTs(e);
      if (!ts) return latest;
      if (!latest) return ts;
      return new Date(ts) > new Date(latest) ? ts : latest;
    }, null);
  }

  // Fall back to dateAdded if no care entries
  const reference = lastCareTs || plant.dateAdded;
  const daysSinceCare = Math.max(0,
    (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Grace period: full health
  if (daysSinceCare <= GRACE_DAYS) return 100;

  // Decay linearly from 100 → 0 over DECAY_DAYS after grace period
  const decayDays = daysSinceCare - GRACE_DAYS;
  const score = Math.max(0, Math.round(100 - (decayDays / DECAY_DAYS) * 100));
  return score;
}

export function getHealthLabel(score) {
  if (score >= 80) return { label: "Thriving", color: "#43a047", icon: "💚" };
  if (score >= 60) return { label: "Healthy",  color: "#7cb342", icon: "💛" };
  if (score >= 40) return { label: "Stressed", color: "#f9a825", icon: "🟠" };
  if (score >= 20) return { label: "Wilting",  color: "#e65100", icon: "🔴" };
  return               { label: "Critical",  color: "#c62828", icon: "☠️" };
}

export function getHealthColor(score) {
  return getHealthLabel(score).color;
}
