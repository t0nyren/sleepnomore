import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { findUserByEmail, publicUser } from "@/lib/store/users";
import { signSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "请填写有效的邮箱和密码。" },
      { status: 400 },
    );
  }

  const user = findUserByEmail(parsed.data.email);
  // Always do a bcrypt compare so timing doesn't leak user existence. The
  // dummy hash below was generated from a throwaway password with cost=12.
  const dummyHash = "$2a$12$teAPVrS7Iz6Qh3tTOTZFyuzbwvaeQFZ.kBzOVdmSkkjzoEiX87sM2";
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);

  if (!user || !ok) {
    return NextResponse.json(
      { error: "invalid_credentials", message: "邮箱或密码不正确。" },
      { status: 401 },
    );
  }

  const token = await signSession(user);
  await setSessionCookie(token);
  return NextResponse.json({ user: publicUser(user) });
}
