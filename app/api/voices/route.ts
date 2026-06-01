import { NextResponse } from "next/server";
import { PRESET_VOICES, type VoiceId } from "@/lib/adapters/minimax";
import { signedUrl } from "@/lib/adapters/cos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the v1 preset voices plus a signed URL to a 30s sample for each.
 * Samples were pre-generated and uploaded to COS at `_samples/<provider_voice_id>.mp3`.
 */
export async function GET() {
  const voices = (Object.keys(PRESET_VOICES) as VoiceId[]).map((id) => {
    const v = PRESET_VOICES[id];
    const safeProviderId = v.providerVoiceId.replace(/[^a-zA-Z0-9_()_-]/g, "_");
    let sampleUrl: string | null = null;
    try {
      sampleUrl = signedUrl(`_samples/${safeProviderId}.mp3`, 30 * 60);
    } catch {
      sampleUrl = null;
    }
    return {
      id,
      displayName: v.displayName,
      providerVoiceId: v.providerVoiceId,
      sampleUrl,
    };
  });
  return NextResponse.json({ voices });
}
