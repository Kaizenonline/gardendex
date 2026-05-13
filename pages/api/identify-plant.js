// pages/api/identify-plant.js
// Secure server-side proxy — keeps ANTHROPIC_API_KEY off the browser.
// Optionally checks and decrements scan credits when Supabase is configured.

import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, imageMime, userId } = req.body;
  if (!imageBase64 || !imageMime) return res.status(400).json({ error: "imageBase64 and imageMime are required" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });

  // ── Optional credit check (only runs when Supabase is configured + userId provided) ──
  if (userId) {
    const db = supabaseAdmin();
    if (db) {
      const { data: canScan, error } = await db.rpc("spend_credit", { p_user_id: userId });
      if (error) {
        console.error("Credit check error:", error);
        return res.status(500).json({ error: "Could not verify credits" });
      }
      if (!canScan) {
        return res.status(402).json({
          error: "out_of_credits",
          message: "You have no scans remaining. Purchase more to continue.",
        });
      }
    }
  }

  // ── Identify the plant ────────────────────────────────────────────────────
  const prompt = `You are an expert botanist with access to web search. Analyze this plant image carefully.
If helpful, search the web for accurate growing data, regional advice, or variety-specific information.
Return ONLY a raw JSON object — no markdown, no backticks, no preamble:
{
  "name": "Common name",
  "species": "Genus species (var. if known)",
  "type": "Vegetable|Fruit|Herb|Flower|Succulent|Tree|Grass|Other",
  "rarity": "Common|Uncommon|Rare|Legendary",
  "emoji": "single best emoji",
  "vigor": <integer 30-99>,
  "stats": { "sunlight": <0-100>, "water": <0-100>, "difficulty": <0-100> },
  "details": {
    "soilType": "Soil preference",
    "pH": "Optimal pH range",
    "harvestTime": "Days or weeks to harvest/bloom",
    "sunHours": "Daily sun requirement",
    "spacing": "Recommended spacing",
    "funFact": "One fascinating botanical or culinary fact",
    "careNotes": "Single most important care tip"
  }
}
Rarity: Common=everyday, Uncommon=less typical, Rare=unusual/specialist, Legendary=exotic/very hard to find.
Output raw JSON only.`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imageMime, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      console.error("Anthropic error:", data);
      return res.status(anthropicRes.status).json({ error: data.error?.message || "Anthropic API error" });
    }

    const rawText = data.content
      .filter(c => c.type === "text")
      .map(c => c.text || "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let plant;
    try {
      plant = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Failed to parse plant JSON:", rawText.slice(0, 300));
      return res.status(500).json({ error: "Could not parse plant identification response" });
    }

    return res.status(200).json({ plant });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
