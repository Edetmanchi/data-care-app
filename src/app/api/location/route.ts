import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { coarse, record } from "@/lib/server/db";
import { geocode, reverseGeocode, type Place } from "@/lib/server/osm";
import { getActor } from "@/lib/server/visitor";

/** Forward search for manual address entry. Logged so manual-entry demand is measurable. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200);
  if (!q || q.length < 2) return NextResponse.json({ places: [] });
  try {
    return NextResponse.json({ places: await geocode(q) });
  } catch (err) {
    console.error("[datacare] geocode failed:", err);
    return NextResponse.json({ places: [], error: "geocoder_unavailable" }, { status: 502 });
  }
}

const Body = z.object({
  method: z.enum(["gps", "manual", "saved", "tracking"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().nonnegative().optional(),
  label: z.string().max(200).optional(),
  query: z.string().max(200).optional(),
  error: z.string().max(60).optional(),
  reverse: z.boolean().optional(),
});

/** Records a location detection (successful or failed) and optionally reverse-geocodes it. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const b = parsed.data;

  let place: Place | null = null;
  if (b.reverse && b.lat != null && b.lng != null) {
    place = await reverseGeocode(b.lat, b.lng).catch(() => null);
  }

  const actor = await getActor();
  if (actor) {
    const success = !b.error && b.lat != null;
    await record(
      (sql) => sql`
        insert into location_detections (visitor_id, user_id, method, lat, lng, accuracy_m, label, state, lga, query, success, error)
        values (${actor.visitorId}, ${actor.userId}, ${b.method},
                ${b.lat != null ? coarse(b.lat) : null}, ${b.lng != null ? coarse(b.lng) : null},
                ${b.accuracy != null ? Math.round(b.accuracy) : null},
                ${place?.label ?? b.label ?? null}, ${place?.state ?? null}, ${place?.lga ?? null},
                ${b.query ?? null}, ${success}, ${b.error ?? null})`,
    );
  }
  return NextResponse.json({ place });
}
