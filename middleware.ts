/**
 * Auth gate. Verifies the session JWT on the cookie and redirects
 * unauthenticated requests to /login (preserving the intended next URL).
 *
 * Runs on Edge runtime — only `jose` for verification, no file I/O.
 * The `getCurrentUser()` helper in route handlers does the deeper lookup
 * against the file-backed users store.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "mianan_session";

const PROTECTED_PREFIXES = ["/create", "/voices", "/story", "/account"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    const secret = process.env.MIANAN_AUTH_SECRET;
    if (secret && secret.length >= 32) {
      try {
        await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
        return NextResponse.next();
      } catch {
        // fallthrough to redirect
      }
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip middleware for static assets, Next internals, and all API routes.
  // API routes do their own auth check so they can return JSON 401 instead of
  // an HTML redirect.
  matcher: ["/((?!_next|api/|favicon.ico|icons|manifest.webmanifest|sw.js).*)"],
};
