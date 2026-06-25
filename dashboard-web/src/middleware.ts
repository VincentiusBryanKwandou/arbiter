import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

function requestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function middleware(req: NextRequest) {
  const rid = requestId();
  const { pathname } = req.nextUrl;

  // Paths that never require auth
  const isApi     = pathname.startsWith("/api/");
  const isLogin   = pathname.startsWith("/login");
  const isStatic  = pathname.startsWith("/_next/");

  // Propagate request ID to route handlers
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-request-id", rid);

  // Only the authenticated shell routes require a session — / and /signup are public
  const isProtected = /^\/(dashboard|trades|backtest|risk|settings|markets)(\/|$)/.test(pathname);
  if (isProtected) {
    const secret = process.env.NEXTAUTH_SECRET;
    // Fail-secure: deny access if secret is not configured rather than allowing through
    if (!secret) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("x-request-id", rid);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
