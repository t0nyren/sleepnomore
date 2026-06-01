import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { publicUser } from "@/lib/store/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: publicUser(user) });
}
