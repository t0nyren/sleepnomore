import { NextResponse } from "next/server";
import { loadStory, finalizeIfStale } from "@/lib/store/stories";
import { signedUrl } from "@/lib/adapters/cos";
import { voiceDisplayNameForUser } from "@/lib/store/voices";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const loaded = loadStory(id);
  if (!loaded) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Ownership check: stories with a userId are visible only to that user.
  // Legacy stories without userId remain publicly viewable by anyone with the link.
  if (loaded.userId) {
    const user = await getCurrentUser();
    if (!user || user.id !== loaded.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const story = finalizeIfStale(loaded);

  // Hydrate audio URLs for ready chapters. Signed 30 minutes.
  const voiceDisplayName = voiceDisplayNameForUser(story.userId, story.voiceId);

  const chapters = story.chapters.map((c) => ({
    idx: c.idx,
    title: c.title,
    text: c.text,
    audioKey: c.audioKey,    // stable identifier — client uses this to detect "same audio"
    audioUrl: c.audioKey ? signedUrl(c.audioKey, 30 * 60) : null,
    audioDurationMs: c.audioDurationMs,
    status: c.status,
  }));

  return NextResponse.json({
    id: story.id,
    status: story.status,
    title: story.title,
    summary: story.summary,
    progress: story.progress,
    error: story.error,
    voice: voiceDisplayName ? { id: story.voiceId, displayName: voiceDisplayName } : { id: story.voiceId },
    chapters,
    params: story.params,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  });
}
