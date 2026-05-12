// lib/stripe.js
// Stripe client — server-side only, never import in frontend.
// Initialised lazily so missing keys don't crash at startup.

let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    const Stripe = require("stripe");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2024-04-10",
    });
  }
  return _stripe;
}

// Proxy object — behaves like the stripe client but initialises lazily
export const stripe = new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
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
