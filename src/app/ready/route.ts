import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness — can the process actually serve traffic (DB reachable)? Never reveals the DB path, a connection string, or any other infra detail (§21) — only a boolean per dependency. */
export async function GET() {
  let dbOk = false;
  try {
    getDb().prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "not_ready";
  return NextResponse.json(
    { status, checks: { database: dbOk } },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
