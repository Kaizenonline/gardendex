// pages/api/create-checkout.js
// Creates a Stripe Checkout session for credit packs OR Pro upgrade.

import { stripe, CREDIT_PACKS, PRO_TIER } from "../../lib/stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!stripe) return res.status(503).json({ error: "Payments not configured" });

  const { packId, userId, userEmail } = req.body;
  if (!packId || !userId) return res.status(400).json({ error: "packId and userId required" });

  // Find in credit packs or Pro tier
  const pack = packId === "pro_lifetime"
    ? PRO_TIER
    : CREDIT_PACKS.find(p => p.id === packId);

  if (!pack) return res.status(400).json({ error: "Invalid pack" });

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const sessionConfig = {
      payment_method_types: ["card"],
      customer_email: userEmail,
      metadata: {
        userId,
        packId,
        credits: pack.credits.toString(),
        isPro: pack.isPro ? "true" : "false",
      },
      success_url: `${appUrl}?payment=success&credits=${pack.credits}&pro=${pack.isPro}`,
      cancel_url: `${appUrl}?payment=cancelled`,
    };

    if (pack.isSubscription) {
      const priceId = process.env.STRIPE_UNLIMITED_PRICE_ID;
      if (!priceId) return res.status(503).json({ error: "Subscription pricing not configured" });
      sessionConfig.mode = "subscription";
      sessionConfig.line_items = [{
        price: priceId,
        quantity: 1,
      }];
      // Store userId in subscription metadata for renewal handling
      sessionConfig.subscription_data = { metadata: { userId } };
    } else {
      // One-time (credit packs + Pro)
      sessionConfig.mode = "payment";
      sessionConfig.line_items = [{
        price_data: {
          currency: "usd",
          unit_amount: pack.price,
          product_data: {
            name: `GardenDex — ${pack.name}`,
            description: pack.description,
          },
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: "Could not create checkout session" });
  }
}
