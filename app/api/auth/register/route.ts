import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createUser, normalizeEmail, publicUser } from "@/lib/store/users";
import { signSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(120),
  displayName: z.string().trim().min(1).max(40).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "邮箱格式有问题，密码至少 8 位。" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const displayName = parsed.data.displayName?.trim() || email.split("@")[0];

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = createUser({ email, passwordHash, displayName });
    const token = await signSession(user);
    await setSessionCookie(token);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (err: any) {
    if (err.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { error: "email_exists", message: "这个邮箱已经注册过了，请直接登录。" },
        { status: 409 },
      );
    }
    console.error("[auth/register]", err);
    return NextResponse.json(
      { error: "internal", message: "注册失败，请稍后再试。" },
      { status: 500 },
    );
  }
}
