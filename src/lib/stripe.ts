import Stripe from "stripe";
import type { SubscriptionPlan } from "./subscriptions";

let client: Stripe | null = null;

export class ServerConfigError extends Error {
  constructor(public variable: string) {
    super(`Missing environment variable: ${variable}`);
    this.name = "ServerConfigError";
  }
}

export function envRequired(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new ServerConfigError(name);
  return value.trim();
}

export function getStripe(): Stripe {
  if (client) return client;
  client = new Stripe(envRequired("STRIPE_SECRET_KEY"), {
    appInfo: { name: "RentYourTime" },
    apiVersion: "2025-08-27.basil",
  });
  return client;
}

/** Map a Stripe Price's billing interval to our internal plan enum. */
export function planFromInterval(interval: string | null | undefined): SubscriptionPlan {
  if (interval === "month") return "MONTHLY";
  if (interval === "year") return "YEARLY";
  return "UNKNOWN";
}

/**
 * `current_period_end` moved off the top-level Subscription object onto its
 * items in newer Stripe API versions (each item can now have its own billing
 * cycle). Read it defensively: prefer the top-level field if present (older
 * API versions / already-expanded objects), else fall back to the first
 * subscription item.
 */
export function resolveCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const topLevel = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof topLevel === "number") return topLevel;
  const itemLevel = subscription.items?.data?.[0]?.current_period_end;
  return typeof itemLevel === "number" ? itemLevel : null;
}
