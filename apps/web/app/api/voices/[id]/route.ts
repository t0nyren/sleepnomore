import { NextResponse } from "next/server";
import { deleteClonedVoice, deleteVoiceCloneSourceFile } from "@/lib/adapters/minimax";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteUserVoice, findUserVoice } from "@/lib/store/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const voice = findUserVoice(user.id, id);
  if (!voice) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    await deleteClonedVoice(voice.providerVoiceId);
    if (typeof voice.sourceFileId === "number") {
      await deleteVoiceCloneSourceFile(voice.sourceFileId).catch((err) => {
        console.warn(`[voices] source file delete failed for ${voice.sourceFileId}:`, err);
      });
    }
  } catch (err) {
    console.error(`[voices] provider voice delete failed for ${voice.providerVoiceId}:`, err);
    return NextResponse.json(
      { error: "provider_delete_failed", message: "声音删除失败，请稍后重试。" },
      { status: 502 },
    );
  }
  const ok = deleteUserVoice(user.id, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
