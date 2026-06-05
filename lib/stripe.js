// lib/stripe.js
// Stripe client — server-side only, never import in frontend.
// Initialised lazily so missing keys don't crash at startup.

import Stripe from "stripe";

let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    _stripe = new Stripe(key, { apiVersion: "2024-04-10" });
  }
  return _stripe;
}

// Proxy — behaves like stripe client but returns null-safe stubs when not configured
export const stripe = new Proxy({}, {
  get(_, prop) {
    const client = getStripe();
    if (!client) {
      // Return a function that rejects with a helpful error
      return (...args) => Promise.reject(new Error("Stripe not configured"));
    }
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export const CREDIT_PACKS = [
  { id: "starter",           name: "Starter Pack",       credits: 50,    price: 299,  displayPrice: "$2.99",    description: "50 plant scans",                  popular: false, isSubscription: false, isPro: false },
  { id: "garden",            name: "Garden Pack",         credits: 200,   price: 799,  displayPrice: "$7.99",    description: "200 plant scans — best value",    popular: true,  isSubscription: false, isPro: false },
  { id: "unlimited_monthly", name: "Unlimited Monthly",   credits: 99999, price: 499,  displayPrice: "$4.99/mo", description: "Unlimited scans, billed monthly", popular: false, isSubscription: true,  isPro: false },
];

export const PRO_TIER = {
  id: "pro_lifetime",
  name: "GardenDex Pro",
  credits: 99999,
  price: 999,
  displayPrice: "$9.99",
  description: "Unlimited scans & plants, forever. One-time payment.",
  badge: "🌟 PRO",
  perks: [
    "Unlimited plant scans — forever",
    "Unlimited collection size",
    "Pro badge on your collection",
    "Priority access to new features",
  ],
  isSubscription: false,
  isPro: true,
};

export const PRO_DAILY_SCAN_LIMIT = 50;
export const FREE_PLANT_LIMIT = 15;
