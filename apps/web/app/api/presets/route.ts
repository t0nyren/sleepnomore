import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/presets/catalog";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const cat = getCatalog();
  return NextResponse.json({
    series: cat.series,
    chapters: cat.chapters,
  });
}
