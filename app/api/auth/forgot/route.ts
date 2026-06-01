import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { findUserByEmail, normalizeEmail, updateUser } from "@/lib/store/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ForgotSchema = z.object({
  email: z.string().email().max(120),
});

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function baseUrl(req: Request): string {
  const env = process.env.MIANAN_PUBLIC_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "sleepnomore.secondlife.today";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ForgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "请填写有效的邮箱。" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const user = findUserByEmail(email);

  if (user) {
    const token = randomBytes(32).toString("hex"); // 64-char hex
    const tokenHash = createHash("sha256").update(token).digest("hex");
    updateUser(user.id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    });
    const url = `${baseUrl(req)}/reset?token=${token}`;
    // No SMTP integration yet — admin grabs the URL from journalctl.
    // 2026-05-31: Tony approved this trade-off; switch to email when SMTP added.
    console.log(`[auth/forgot] reset-url for ${email}: ${url}`);
  }

  // Always return success — don't leak whether the email is registered.
  return NextResponse.json({ ok: true });
}
