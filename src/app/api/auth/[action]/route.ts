import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/i18n";
import { clearSession, createSession, getSession } from "@/lib/server/auth";
import { db, record } from "@/lib/server/db";
import { getActor } from "@/lib/server/visitor";

const PHONE = /^\+?[0-9]{10,14}$/;

const Identifier = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => PHONE.test(v) || z.email().safeParse(v).success, "invalid_identifier");

const Register = z.object({
  name: z.string().trim().min(1).max(80),
  identifier: Identifier,
  password: z.string().min(6).max(128),
  language: z.enum(LANGUAGE_CODES).default("en"),
});
const Login = z.object({ identifier: Identifier, password: z.string().min(1).max(128) });
const Language = z.object({ language: z.enum(LANGUAGE_CODES) });

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

function splitIdentifier(id: string) {
  return PHONE.test(id) ? { email: null, phone: normalisePhone(id) } : { email: id.toLowerCase(), phone: null };
}
/** 08012345678 → +2348012345678 */
function normalisePhone(p: string) {
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return "+234" + p.slice(1);
  if (p.startsWith("234")) return "+" + p;
  return p;
}

async function linkVisitor(userId: string) {
  const actor = await getActor();
  if (actor) await record((sql) => sql`update visitors set user_id = ${userId} where id = ${actor.visitorId}`);
  return actor;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const sql = db();
  const body = await req.json().catch(() => ({}));

  if (action === "logout") {
    await clearSession();
    return NextResponse.json({ ok: true });
  }
  if (action === "language" && !(await getSession())) {
    return NextResponse.json({ ok: false }); // anonymous: preference lives in the browser
  }
  if (!sql) return fail("accounts_unavailable", 503);

  if (action === "register") {
    const parsed = Register.safeParse(body);
    if (!parsed.success) return fail("invalid_input");
    const { name, identifier, password, language } = parsed.data;
    const { email, phone } = splitIdentifier(identifier);
    const hash = await bcrypt.hash(password, 11);
    try {
      const [user] = await sql`
        insert into users (full_name, email, phone, password_hash, preferred_language)
        values (${name}, ${email}, ${phone}, ${hash}, ${language})
        returning id, full_name, preferred_language`;
      await createSession({ userId: user.id, name: user.full_name });
      const actor = await linkVisitor(user.id);
      if (actor) await record((s) => s`insert into events (visitor_id, user_id, name) values (${actor.visitorId}, ${user.id}, 'signup')`);
      return NextResponse.json({ user: { id: user.id, name: user.full_name, language: user.preferred_language } });
    } catch (err) {
      if (String(err).includes("duplicate key")) return fail("account_exists", 409);
      throw err;
    }
  }

  if (action === "login") {
    const parsed = Login.safeParse(body);
    if (!parsed.success) return fail("invalid_input");
    const { email, phone } = splitIdentifier(parsed.data.identifier);
    const [user] = email
      ? await sql`select id, full_name, password_hash, preferred_language from users where email = ${email}`
      : await sql`select id, full_name, password_hash, preferred_language from users where phone = ${phone}`;
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return fail("bad_credentials", 401);
    await sql`update users set last_login_at = now() where id = ${user.id}`;
    await createSession({ userId: user.id, name: user.full_name });
    const actor = await linkVisitor(user.id);
    if (actor) await record((s) => s`insert into events (visitor_id, user_id, name) values (${actor.visitorId}, ${user.id}, 'login')`);
    return NextResponse.json({ user: { id: user.id, name: user.full_name, language: user.preferred_language } });
  }

  if (action === "language") {
    const session = (await getSession())!;
    const parsed = Language.safeParse(body);
    if (!parsed.success) return fail("invalid_input");
    await sql`update users set preferred_language = ${parsed.data.language} where id = ${session.userId}`;
    return NextResponse.json({ ok: true });
  }

  return fail("not_found", 404);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return fail("not_found", 404);
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const sql = db();
  const [user] = sql ? await sql`select id, full_name, preferred_language from users where id = ${session.userId}` : [];
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, name: user.full_name, language: user.preferred_language } });
}
