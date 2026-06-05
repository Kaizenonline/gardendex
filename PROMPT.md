# Claude Code Deployment Prompt
Paste this into Claude Code to deploy the update.

---

I have a Next.js app called GardenDex. Please do the following in order:

**1. Copy in the updated files**
Unzip `gardendex-final.zip` from the project root and copy every file into the project at its exact path. The `public/` folder images should go into the project's `/public/` directory (create it if it doesn't exist).

**2. Delete these files — they are dead code and must be removed from the project:**
```
components/BattleSystem.jsx
components/TournamentMode.jsx
components/DailyChallenge.jsx
components/RankBadge.jsx
lib/attacks.js
lib/dailyChallenge.js
lib/ranks.js
```
Use `rm` to delete each one. After deleting, confirm each file no longer exists by running `ls` on the relevant directories.

**3. Run the SQL migration**
Print the contents of `supabase-schema.sql` so I can paste it into the Supabase Dashboard SQL Editor.

**4. Build and verify**
Run `npm run build`. If there are any errors, fix them. If it passes, confirm the build is clean.

**5. Deploy**
```bash
git add .
git commit -m "Pre-launch cleanup — remove battle system, apply all fixes"
git push
```
