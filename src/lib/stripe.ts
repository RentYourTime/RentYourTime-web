import Stripe from "stripe";

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
  });
  return client;
}
