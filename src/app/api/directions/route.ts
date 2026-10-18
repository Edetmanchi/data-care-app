import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { record } from "@/lib/server/db";
import { osrmRoute } from "@/lib/server/osm";
import { getActor } from "@/lib/server/visitor";

const Body = z.object({
  from: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
  to: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
  mode: z.enum(["driving", "walking"]),
  facilityId: z.string().max(80).nullable(),
  facilityName: z.string().max(200).nullable(),
  searchId: z.uuid().nullable(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { from, to, mode, facilityId, facilityName, searchId } = parsed.data;

  let route = null;
  try {
    route = await osrmRoute(mode, from, to);
  } catch (err) {
    console.error("[datacare] routing failed:", err);
  }

  const actor = await getActor();
  if (actor) {
    await record(
      (sql) => sql`
        insert into direction_requests (visitor_id, user_id, search_id, facility_id, facility_name, mode, distance_m, duration_s, success)
        values (${actor.visitorId}, ${actor.userId}, ${searchId},
                (select id from facilities where id = ${facilityId}), ${facilityName}, ${mode},
                ${route?.distanceM ?? null}, ${route?.durationS ?? null}, ${route !== null})`,
    );
  }

  if (!route) return NextResponse.json({ error: "no_route" }, { status: 502 });
  return NextResponse.json(route);
}
