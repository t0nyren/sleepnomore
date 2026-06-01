import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { findUserByResetTokenHash, updateUser } from "@/lib/store/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ResetSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: z.string().min(8).max(120),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "链接或密码格式不对，新密码至少 8 位。" },
      { status: 400 },
    );
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const user = findUserByResetTokenHash(tokenHash);
  if (!user) {
    return NextResponse.json(
      { error: "invalid_token", message: "重置链接无效或已过期，请重新申请。" },
      { status: 400 },
    );
  }

  try {
    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    updateUser(user.id, {
      passwordHash: newHash,
      passwordResetTokenHash: undefined,
      passwordResetExpiresAt: undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset]", err);
    return NextResponse.json({ error: "internal", message: "操作失败，请稍后再试。" }, { status: 500 });
  }
}
