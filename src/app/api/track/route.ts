import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { record } from "@/lib/server/db";
import { getActor } from "@/lib/server/visitor";

const Body = z.object({
  name: z.string().regex(/^[a-z0-9_]{2,48}$/),
  path: z.string().max(200).optional(),
  lang: z.string().max(8).optional(),
  props: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).optional(),
});

/** Generic interaction log (page views, language changes, call taps, auth prompts …). */
export async function POST(req: NextRequest) {
  // Accepts text/plain too, since navigator.sendBeacon posts that.
  const parsed = Body.safeParse(await req.text().then((t) => JSON.parse(t)).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { name, path, lang, props } = parsed.data;

  const actor = await getActor(lang);
  if (actor) {
    await record(
      (sql) => sql`
        insert into events (visitor_id, user_id, name, path, language, props)
        values (${actor.visitorId}, ${actor.userId}, ${name}, ${path ?? null}, ${actor.language}, ${JSON.stringify(props ?? {})}::jsonb)`,
    );
  }
  return new NextResponse(null, { status: 204 });
}
