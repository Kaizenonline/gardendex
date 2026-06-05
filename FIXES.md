# GardenDex — Final Pre-Launch Update

## What's in this package

| File | What changed |
|------|-------------|
| `pages/index.jsx` | All battle/tournament/daily challenge/rank/achievement code removed · userId passed to identify API · FREE_PLANT_LIMIT enforced · Duplicate warning toast |
| `pages/_app.jsx` | Open Graph + Twitter Card meta tags |
| `pages/api/identify-plant.js` | Credit deducted AFTER successful scan, not before |
| `pages/api/stripe-webhook.js` | Subscription renewal includes `is_pro: true` |
| `components/DiagnoseModal.jsx` | userId forwarded to diagnose API |
| `lib/health.js` | Normalised timestamp field (timestamp / ts / date) |
| `lib/achievements.js` | Silent catch replaced with console.warn |
| `lib/location.js` | Nominatim 429 rate-limit handled gracefully |
| `public/icon-192.png` | PWA home screen icon (new) |
| `public/icon-512.png` | PWA high-res icon (new) |
| `public/og-preview.png` | Social share preview card (new) |
| `supabase-schema.sql` | plants index · spend_credit auto-creates row · add_credits daily reset |

## Files to DELETE from your repo

These are dead code — battle system fully removed:

```
components/BattleSystem.jsx
components/TournamentMode.jsx
components/DailyChallenge.jsx
components/RankBadge.jsx
lib/attacks.js
lib/dailyChallenge.js
lib/ranks.js
```

## Steps

1. Copy all files from this zip into your project at the paths shown
2. Delete the 7 files listed above
3. Run `supabase-schema.sql` in Supabase Dashboard → SQL Editor
4. `npm run build` — confirm no errors
5. `git add . && git commit -m "Pre-launch cleanup" && git push`
