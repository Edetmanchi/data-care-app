import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";

/** Aggregate impact numbers for reporting. Requires `Authorization: Bearer $STATS_TOKEN`. */
export async function GET(req: NextRequest) {
  const token = process.env.STATS_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = db();
  if (!sql) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const [totals, byType, languages, daily] = await Promise.all([
    sql`select * from v_impact_totals`,
    sql`select * from v_searches_by_type order by searches desc`,
    sql`select * from v_language_usage order by visitors desc`,
    sql`select * from v_daily_usage order by day desc limit 30`,
  ]);
  return NextResponse.json({ totals: totals[0], searchesByType: byType, languages, daily });
}
