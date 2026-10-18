import { NextResponse, type NextRequest } from "next/server";

// Gives every browser an anonymous visitor id so usage is counted without requiring an account.
export function middleware(req: NextRequest) {
  if (req.cookies.get("dc_vid")) return NextResponse.next();

  const id = crypto.randomUUID();
  // Make the id visible to route handlers on this very first request too.
  const reqHeaders = new Headers(req.headers);
  const existing = req.headers.get("cookie");
  reqHeaders.set("cookie", existing ? `${existing}; dc_vid=${id}` : `dc_vid=${id}`);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.cookies.set("dc_vid", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|webp|ico|mjs)$).*)"],
};
