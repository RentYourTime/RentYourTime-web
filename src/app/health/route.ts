import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness — the process is up and can answer HTTP. No DB access, no secrets, no infra details (§21). */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
