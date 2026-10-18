import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isFacilityType, type Facility, type FacilityType, type SearchResponse } from "@/lib/facility-types";
import { coarse, db, record } from "@/lib/server/db";
import { haversine } from "@/lib/server/geo";
import { searchFacilities } from "@/lib/server/search";
import { getActor } from "@/lib/server/visitor";

const Query = z.object({
  type: z.string().refine(isFacilityType),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  lang: z.string().max(8).optional(),
});

const CACHE_RADIUS_M = 40000;

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const { lat, lng, lang } = parsed.data;
  const type = parsed.data.type as FacilityType;
  const started = Date.now();

  let facilities: Facility[] = [];
  let radiusM = CACHE_RADIUS_M;
  let source: SearchResponse["source"] = "none";

  try {
    ({ facilities, radiusM } = await searchFacilities(type, lat, lng));
    source = "live";
  } catch (err) {
    // Every live source is down: serve facilities previously cached in Neon.
    console.error("[datacare] live search failed, falling back to cache:", err);
    facilities = (await cachedNearby(type, lat, lng)).slice(0, 60);
    source = facilities.length ? "cache" : "none";
  }

  const actor = await getActor(lang);
  let searchId: string | null = null;
  if (actor) {
    if (source === "live" && facilities.length) await cacheFacilities(facilities);
    const rows = await record(
      (sql) => sql`
        insert into facility_searches (visitor_id, user_id, facility_type, lat, lng, radius_m, result_count, source, language, duration_ms)
        values (${actor.visitorId}, ${actor.userId}, ${type}, ${coarse(lat)}, ${coarse(lng)}, ${radiusM},
                ${facilities.length}, ${source}, ${actor.language}, ${Date.now() - started})
        returning id`,
    );
    searchId = (rows?.[0]?.id as string) ?? null;
  }

  return NextResponse.json({ searchId, radiusM, source, facilities } satisfies SearchResponse);
}

async function cacheFacilities(list: Facility[]) {
  await record(async (sql) => {
    // One statement for the whole batch keeps this to a single round-trip.
    const payload = JSON.stringify(
      list.map((f) => ({
        id: f.id, name: f.name, category: f.category, lat: f.lat, lng: f.lng,
        phone: f.phone, address: f.address, opening_hours: f.openingHours,
        tags: { emergency: f.emergency, ownership: f.ownership, source: f.source },
      })),
    );
    return sql`
      insert into facilities (id, name, category, lat, lng, phone, address, opening_hours, tags)
      select id, name, category, lat, lng, phone, address, opening_hours, tags
      from jsonb_to_recordset(${payload}::jsonb)
        as x(id text, name text, category text, lat float8, lng float8, phone text, address text, opening_hours text, tags jsonb)
      on conflict (id) do update set
        name = excluded.name, category = excluded.category, lat = excluded.lat, lng = excluded.lng,
        phone = excluded.phone, address = excluded.address, opening_hours = excluded.opening_hours,
        tags = excluded.tags, last_seen = now()`;
  });
}

async function cachedNearby(type: FacilityType, lat: number, lng: number): Promise<Facility[]> {
  const sql = db();
  if (!sql) return [];
  const d = CACHE_RADIUS_M / 111_000;
  try {
    const rows = await sql`
      select id, name, category, lat, lng, phone, address, opening_hours, tags
      from facilities
      where lat between ${lat - d} and ${lat + d} and lng between ${lng - d} and ${lng + d}
        and (${type} = 'all' or category = ${type})
      limit 300`;
    return rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        distanceM: Math.round(haversine(lat, lng, r.lat, r.lng)),
        phone: r.phone,
        address: r.address,
        openingHours: r.opening_hours,
        emergency: Boolean(r.tags?.emergency),
        ownership: r.tags?.ownership ?? null,
        source: r.tags?.source ?? "osm",
      }))
      .sort((a, b) => a.distanceM - b.distanceM) as Facility[];
  } catch (err) {
    console.error("[datacare] cache lookup failed:", err);
    return [];
  }
}
