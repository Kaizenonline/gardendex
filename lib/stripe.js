// lib/stripe.js
// Stripe client — server-side only, never import in frontend

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

// ── Pricing Tiers ─────────────────────────────────────────────────────────
// Keep all pricing here — referenced by API routes and UI components

export const CREDIT_PACKS = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 50,
    price: 299,           // cents
    displayPrice: "$2.99",
    description: "50 plant scans",
    popular: false,
    isSubscription: false,
    isPro: false,
  },
  {
    id: "garden",
    name: "Garden Pack",
    credits: 200,
    price: 799,
    displayPrice: "$7.99",
    description: "200 plant scans — best value",
    popular: true,
    isSubscription: false,
    isPro: false,
  },
  {
    id: "unlimited_monthly",
    name: "Unlimited Monthly",
    credits: 99999,
    price: 499,
    displayPrice: "$4.99/mo",
    description: "Unlimited scans, billed monthly",
    popular: false,
    isSubscription: true,
    isPro: false,
    // Create this price in Stripe dashboard and paste ID in .env as STRIPE_UNLIMITED_PRICE_ID
  },
];

export const PRO_TIER = {
  id: "pro_lifetime",
  name: "GardenDex Pro",
  credits: 99999,         // treated as unlimited
  price: 999,             // $9.99 one-time
  displayPrice: "$9.99",
  description: "Unlimited scans & plants, forever. One-time payment.",
  badge: "🌟 PRO",
  perks: [
    "Unlimited plant scans — forever",
    "Unlimited collection size",
    "Pro badge on your collection",
    "Priority access to new features",
    "Early access to garden map & health charts",
  ],
  isSubscription: false,
  isPro: true,
};

// Max daily scans for Pro users (abuse prevention — no real gardener hits this)
export const PRO_DAILY_SCAN_LIMIT = 50;
// Max plants in collection for free users
export const FREE_PLANT_LIMIT = 15;
