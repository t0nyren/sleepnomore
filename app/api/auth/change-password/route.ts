import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getCurrentUser, signSession, setSessionCookie } from "@/lib/auth/session";
import { updateUser } from "@/lib/store/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(120),
  newPassword: z.string().min(8).max(120),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required", message: "请先登录。" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "新密码至少 8 位。" },
      { status: 400 },
    );
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "invalid_credentials", message: "当前密码不正确。" },
      { status: 401 },
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { error: "same_password", message: "新密码不能和当前密码一样。" },
      { status: 400 },
    );
  }

  try {
    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const updated = updateUser(user.id, {
      passwordHash: newHash,
      passwordResetTokenHash: undefined,
      passwordResetExpiresAt: undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "internal", message: "保存失败。" }, { status: 500 });
    }
    // Refresh the session cookie so the token reflects the new state.
    const token = await signSession(updated);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/change-password]", err);
    return NextResponse.json({ error: "internal", message: "操作失败，请稍后再试。" }, { status: 500 });
  }
}
