import { NextResponse } from "next/server";

import { getCachedDashboardFixtures } from "@/lib/live-fixtures";

/** GET /api/matches — fixtures (football-data.org or bundled) + Gamma prices */
export async function GET() {
  try {
    const payload = await getCachedDashboardFixtures();
    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set(
      "cache-control",
      "public, s-maxage=300, stale-while-revalidate=120",
    );
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to assemble matches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
