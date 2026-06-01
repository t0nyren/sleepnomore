import Link from "next/link";
import { StoryView } from "./StoryView";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-8 pt-4 sm:pt-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-caption font-medium muted hover:text-[var(--color-ink-900)] transition-colors">
          ← 我的故事
        </Link>
      </header>
      <StoryView storyId={id} />
    </div>
  );
}
