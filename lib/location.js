// lib/location.js
// Location-derived garden context — all calculations are pure math.
// No API key required. Lat/lng comes from browser geolocation or user search.

// ── Solar / daylight calculation ──────────────────────────────────────────────
export function getDaylightHours(lat, date = new Date()) {
  const start    = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  // Solar declination (degrees)
  const decl = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
  const latRad  = lat * (Math.PI / 180);
  const declRad = decl * (Math.PI / 180);
  const cosHa   = -Math.tan(latRad) * Math.tan(declRad);
  if (cosHa <= -1) return 24;  // midnight sun
  if (cosHa >= 1)  return 0;   // polar night
  const hours = (2 * Math.acos(cosHa) * 12) / Math.PI;
  return Math.round(hours * 10) / 10;
}

// ── Season (hemisphere-aware) ─────────────────────────────────────────────────
export function getSeason(lat, date = new Date()) {
  const m = date.getMonth(); // 0–11
  const isNorth = lat >= 0;
  const northSeasons = [
    "Winter","Winter","Spring","Spring","Spring",
    "Summer","Summer","Summer","Autumn","Autumn","Autumn","Winter",
  ];
  const southSeasons = [
    "Summer","Summer","Autumn","Autumn","Autumn",
    "Winter","Winter","Winter","Spring","Spring","Spring","Summer",
  ];
  return isNorth ? northSeasons[m] : southSeasons[m];
}

// ── Approximate USDA hardiness zone from absolute latitude ────────────────────
// Not perfect (ignores elevation, ocean proximity, etc.) but useful as a guide.
export function getHardinessZone(lat) {
  const a = Math.abs(lat);
  if (a < 20)  return "11-12";
  if (a < 24)  return "10b-11";
  if (a < 27)  return "10a-10b";
  if (a < 30)  return "9b-10a";
  if (a < 33)  return "9a-9b";
  if (a < 36)  return "8b-9a";
  if (a < 39)  return "8a-8b";
  if (a < 42)  return "7a-7b";
  if (a < 45)  return "6a-6b";
  if (a < 48)  return "5a-5b";
  if (a < 51)  return "4a-4b";
  if (a < 55)  return "3a-3b";
  if (a < 60)  return "2a-2b";
  return "1";
}

// ── Climate classification ────────────────────────────────────────────────────
export function getClimate(lat) {
  const a = Math.abs(lat);
  if (a < 23.5) return "Tropical";
  if (a < 35)   return "Subtropical";
  if (a < 50)   return "Temperate";
  if (a < 65)   return "Continental";
  return "Polar";
}

// ── Season emoji + current planting advice ────────────────────────────────────
export const SEASON_EMOJI = {
  Spring: "🌸", Summer: "☀️", Autumn: "🍂", Winter: "❄️",
};

export function getSeasonAdvice(season, zone) {
  const z = parseInt(zone) || 7;
  const tips = {
    Spring: z >= 9
      ? "Direct sow warm-season crops. Last frost risk is low."
      : "Start seeds indoors for tomatoes & peppers. Watch for late frosts.",
    Summer: z >= 9
      ? "Shade sensitive plants midday. Water deeply in early morning."
      : "Peak growing season. Harvest regularly to encourage production.",
    Autumn: z >= 9
      ? "Ideal time to plant cool-season crops — lettuce, spinach, brassicas."
      : "Bring tender plants in before first frost. Plant garlic and spring bulbs.",
    Winter: z >= 10
      ? "Grow cool-season crops outdoors. Light frosts may occur overnight."
      : "Plan next year's garden. Order seeds. Protect perennials with mulch.",
  };
  return tips[season] || "";
}

// ── Frost risk label ──────────────────────────────────────────────────────────
export function getFrostRisk(season, zone) {
  const z = parseInt(zone) || 7;
  if (z >= 11) return null;
  if (season === "Summer")  return null;
  if (season === "Winter" && z <= 6) return "high";
  if (season === "Autumn" || season === "Spring") return z <= 7 ? "moderate" : "low";
  if (season === "Winter" && z >= 7)  return "low";
  return null;
}

// ── AI prompt context string ──────────────────────────────────────────────────
// Include this in AI prompts to get regionally-aware responses.
export function buildLocationContext(loc) {
  if (!loc) return "";
  const { city, country, lat, zone, climate, season, daylightHours } = loc;
  const parts = [
    city ? `Location: ${city}${country ? ", " + country : ""}` : `Latitude: ${lat?.toFixed(1)}°`,
    `Climate: ${climate}`,
    `Season: ${season}`,
    `Hardiness zone: ~${zone}`,
    `Current daylight: ${daylightHours}h/day`,
  ];
  return parts.join(" | ");
}

// ── Reverse geocode lat/lng → city name (free, no key) ───────────────────────
// Nominatim: 1 req/sec limit. We handle 429s gracefully and return null rather
// than crashing. Callers should debounce inputs (250ms+) before calling this.
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en", "User-Agent": "GardenDex/1.0 (gardendex.app)" } }
    );
    if (res.status === 429) { console.warn("Nominatim rate limit hit — try again shortly"); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || "";
    const country = addr.country_code?.toUpperCase() || addr.country || "";
    return { city, country };
  } catch {
    return null;
  }
}

// ── Forward geocode city name → lat/lng ──────────────────────────────────────
// Debounce inputs before calling this — Nominatim enforces 1 req/sec.
export async function geocodeCity(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "GardenDex/1.0 (gardendex.app)" } }
    );
    if (res.status === 429) { console.warn("Nominatim rate limit hit — try again shortly"); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const { lat, lon, display_name } = data[0];
    const parts = display_name.split(", ");
    const city = parts[0] || query;
    const country = parts[parts.length - 1] || "";
    return { lat: parseFloat(lat), lng: parseFloat(lon), city, country };
  } catch {
    return null;
  }
}

// ── Build a full location object from lat/lng ─────────────────────────────────
export function buildLocation(lat, lng, city = "", country = "") {
  const season       = getSeason(lat);
  const zone         = getHardinessZone(lat);
  const climate      = getClimate(lat);
  const daylightHours = getDaylightHours(lat);
  return { lat, lng, city, country, season, zone, climate, daylightHours };
}

// ── localStorage persistence ──────────────────────────────────────────────────
export function saveLocation(loc) {
  try { localStorage.setItem("gardendex_location", JSON.stringify(loc)); } catch {}
}

export function loadLocation() {
  try {
    const r = localStorage.getItem("gardendex_location");
    if (!r) return null;
    // Recalculate live values (season/daylight change over time)
    const saved = JSON.parse(r);
    if (!saved?.lat) return null;
    return buildLocation(saved.lat, saved.lng, saved.city, saved.country);
  } catch { return null; }
}
