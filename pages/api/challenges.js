// pages/api/challenges.js
// ─────────────────────────────────────────────────────────────────────────────
// Battle challenge system — requires Supabase + user auth to be active.
// Until then, the frontend uses URL-encoded challenge links (no backend needed).
//
// Once Supabase is set up, uncomment this route and add the schema below.
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase schema (add to supabase-schema.sql) ──────────────────────────
//
// create table if not exists challenges (
//   id uuid primary key default gen_random_uuid(),
//   challenger_id uuid references auth.users(id) on delete cascade,
//   challenged_id uuid references auth.users(id) on delete set null,
//   challenger_plant jsonb not null,      -- snapshot of challenger's plant
//   challenged_plant jsonb,               -- filled in when accepted
//   status text not null default 'pending', -- pending | accepted | completed | expired
//   winner_id uuid references auth.users(id) on delete set null,
//   battle_log jsonb,                     -- full turn-by-turn log
//   created_at timestamptz default now(),
//   expires_at timestamptz default now() + interval '7 days',
//   completed_at timestamptz
// );
//
// alter table challenges enable row level security;
// create policy "Users can see own challenges"
//   on challenges for select
//   using (auth.uid() = challenger_id or auth.uid() = challenged_id);
// create policy "Users can create challenges"
//   on challenges for insert
//   with check (auth.uid() = challenger_id);
// create policy "Challenged user can update"
//   on challenges for update
//   using (auth.uid() = challenged_id or auth.uid() = challenger_id);
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req, res) {
  // ── Auth check ──
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = supabaseAdmin();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  // ── POST /api/challenges — Send a challenge ───────────────────────────────
  if (req.method === "POST") {
    const { challengerPlant, challengedUserId } = req.body;
    if (!challengerPlant) return res.status(400).json({ error: "challengerPlant required" });

    const { data, error } = await db.from("challenges").insert({
      challenger_id: user.id,
      challenged_id: challengedUserId || null, // null = open challenge (anyone can accept)
      challenger_plant: challengerPlant,
      status: "pending",
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ challenge: data });
  }

  // ── GET /api/challenges — Fetch challenges for current user ───────────────
  if (req.method === "GET") {
    const { type } = req.query; // "sent" | "received" | "all"

    let query = db.from("challenges").select("*").order("created_at", { ascending: false });
    if (type === "sent")     query = query.eq("challenger_id", user.id);
    else if (type === "received") query = query.eq("challenged_id", user.id).eq("status", "pending");
    else query = query.or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ challenges: data });
  }

  // ── PATCH /api/challenges — Accept or complete a challenge ────────────────
  if (req.method === "PATCH") {
    const { challengeId, action, challengedPlant, battleLog, winnerId } = req.body;
    if (!challengeId || !action) return res.status(400).json({ error: "challengeId and action required" });

    if (action === "accept") {
      const { data, error } = await db.from("challenges")
        .update({ status: "accepted", challenged_plant: challengedPlant })
        .eq("id", challengeId)
        .eq("challenged_id", user.id)
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ challenge: data });
    }

    if (action === "complete") {
      const { data, error } = await db.from("challenges")
        .update({
          status: "completed",
          battle_log: battleLog,
          winner_id: winnerId,
          completed_at: new Date().toISOString(),
        })
        .eq("id", challengeId)
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ challenge: data });
    }

    return res.status(400).json({ error: "Invalid action" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
