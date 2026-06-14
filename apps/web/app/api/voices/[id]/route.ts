import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteUserVoice } from "@/lib/store/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const ok = deleteUserVoice(user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
