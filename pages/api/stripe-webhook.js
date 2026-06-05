// pages/api/stripe-webhook.js
// Handles Stripe payment events — credits AND Pro upgrades.
// Set as webhook in Stripe dashboard → Developers → Webhooks
// URL: https://your-app.vercel.app/api/stripe-webhook
// Events: checkout.session.completed, invoice.payment_succeeded

import { stripe } from "../../lib/stripe";
import { supabaseAdmin } from "../../lib/supabase";

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const db = supabaseAdmin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, packId, credits, isPro } = session.metadata;

    try {
      if (isPro === "true") {
        // ── Pro upgrade ──────────────────────────────────────────────────
        const { error } = await db.rpc("upgrade_to_pro", {
          p_user_id: userId,
          p_payment_id: session.id,
          p_amount_cents: session.amount_total,
        });
        if (error) throw error;
        console.log(`⭐ User ${userId} upgraded to Pro`);

      } else {
        // ── Credit pack purchase ─────────────────────────────────────────
        const { error } = await db.rpc("add_credits", {
          p_user_id: userId,
          p_credits: parseInt(credits, 10),
          p_payment_id: session.id,
          p_amount_cents: session.amount_total,
        });
        if (error) throw error;
        console.log(`✅ Added ${credits} credits to user ${userId}`);
      }
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Failed to process payment" });
    }
  }

  // Subscription renewal — reset unlimited balance
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    if (invoice.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        // userId stored in subscription metadata when checkout was created
        const userId = subscription.metadata?.userId || subscription.metadata?.user_id;
        if (userId) {
          await db.from("credits").upsert({
            user_id: userId,
            balance: 99999,
            is_pro: true, // Fix #5: must be included or renewal can leave is_pro=false
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          console.log(`🔄 Renewed unlimited for user ${userId}`);
        }
      } catch (err) {
        console.error("Subscription renewal error:", err);
      }
    }
  }

  return res.status(200).json({ received: true });
}
