/**
 * Stateless session via JWT in an httpOnly cookie.
 *
 * Why stateless: we already have file-backed storage; adding a per-session
 * file just to enable instant revocation isn't worth the complexity at this
 * scale. JWT exp is set short enough (30 days) that token theft is bounded;
 * for forced logout-everyone, rotate `MIANAN_AUTH_SECRET`.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { findUserById, type User } from "@/lib/store/users";

const COOKIE_NAME = "mianan_session";
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days
const ALG = "HS256";

function secretKey(): Uint8Array {
  const s = process.env.MIANAN_AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("MIANAN_AUTH_SECRET must be set (>=32 chars) in /etc/mianan/env");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(user: User): Promise<string> {
  return new SignJWT({ uid: user.id, email: user.email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<{ uid: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    if (typeof payload.uid !== "string" || typeof payload.email !== "string") return null;
    return { uid: payload.uid, email: payload.email };
  } catch {
    return null;
  }
}

/** Set the session cookie on the outgoing response. Call from a route handler. */
export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Read the current session and resolve to a User, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return findUserById(payload.uid);
}
