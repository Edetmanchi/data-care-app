import "server-only";
import { cookies, headers } from "next/headers";
import { getSession } from "./auth";
import { record } from "./db";

export const VISITOR_COOKIE = "dc_vid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Actor = { visitorId: string; userId: string | null; language: string };

/**
 * Identifies who is making the request (anonymous visitor + optional signed-in user)
 * and makes sure the visitor row exists, so every activity row can reference it.
 */
export async function getActor(language?: string): Promise<Actor | null> {
  const jar = await cookies();
  const visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!visitorId || !UUID.test(visitorId)) return null;

  const session = await getSession();
  const lang = language ?? jar.get("dc_lang")?.value ?? "en";
  const h = await headers();
  const ua = h.get("user-agent")?.slice(0, 300) ?? null;
  const ref = h.get("referer")?.slice(0, 300) ?? null;
  const userId = session?.userId ?? null;

  await record(
    (sql) => sql`
      insert into visitors (id, user_id, language, user_agent, referrer)
      values (${visitorId}, ${userId}, ${lang}, ${ua}, ${ref})
      on conflict (id) do update set
        last_seen   = now(),
        visit_count = visitors.visit_count + case when visitors.last_seen < now() - interval '30 minutes' then 1 else 0 end,
        user_id     = coalesce(excluded.user_id, visitors.user_id),
        language    = excluded.language
    `,
  );

  return { visitorId, userId, language: lang };
}
