// pages/api/diagnose-plant.js
// Diagnoses plant diseases, pests, and deficiencies from a photo.
// Uses web search for accurate, up-to-date treatment information.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, imageMime, plantName, plantSpecies } = req.body;
  if (!imageBase64 || !imageMime) return res.status(400).json({ error: "imageBase64 and imageMime are required" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });

  const context = plantName
    ? `This photo is of a ${plantName}${plantSpecies ? ` (${plantSpecies})` : ""}.`
    : "The plant species is unknown.";

  const prompt = `You are an expert plant pathologist and horticulturalist with access to web search.
${context}
Carefully examine this photo for signs of disease, pest damage, nutrient deficiency, or other problems.
If helpful, search the web for accurate treatment protocols and current best practices.

Return ONLY a raw JSON object — no markdown, no backticks, no preamble:
{
  "issue": "Short name of the problem (e.g. 'Powdery Mildew', 'Spider Mites', 'Iron Deficiency', 'Overwatering')",
  "category": "Disease|Pest|Deficiency|Environmental|Healthy",
  "severity": "Mild|Moderate|Severe",
  "severityScore": <1-10 integer>,
  "confidence": "High|Medium|Low",
  "description": "2-3 sentence description of what you see and what it is",
  "cause": "What caused or triggered this problem",
  "symptoms": ["visible symptom 1", "visible symptom 2", "visible symptom 3"],
  "treatment": [
    {"step": 1, "action": "Immediate action to take", "urgency": "Now|Soon|Optional"},
    {"step": 2, "action": "Follow-up treatment", "urgency": "Now|Soon|Optional"},
    {"step": 3, "action": "Recovery support", "urgency": "Now|Soon|Optional"}
  ],
  "prevention": "How to prevent this recurring in future",
  "spreadRisk": "None|Low|Medium|High",
  "organicOption": "An organic or natural treatment alternative if available, otherwise null"
}

If the plant looks completely healthy, set category to "Healthy", severity to "Mild", severityScore to 1.
If you cannot determine a specific issue, give your best assessment with confidence "Low".
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
      return res.status(anthropicRes.status).json({ error: data.error?.message || "API error" });
    }

    const rawText = data.content
      .filter(c => c.type === "text")
      .map(c => c.text || "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let diagnosis;
    try {
      diagnosis = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Failed to parse diagnosis JSON:", rawText.slice(0, 200));
      return res.status(500).json({ error: "Could not parse diagnosis response" });
    }
    return res.status(200).json({ diagnosis });

  } catch (err) {
    console.error("Diagnose error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
