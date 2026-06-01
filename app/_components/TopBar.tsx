import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { UserMenu } from "./UserMenu";

export async function TopBar() {
  const user = await getCurrentUser();
  return (
    <header className="flex items-center justify-between py-5">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="display text-[1.25rem] tracking-tight">眠安</span>
      </Link>
      <nav className="flex items-center gap-1.5 text-caption">
        {user ? (
          <>
            <Link href="/" className="pill" data-selected={false}>我的故事</Link>
            <Link href="/create" className="pill" data-selected={false}>开始创作</Link>
            <UserMenu displayName={user.displayName} />
          </>
        ) : (
          <Link href="/login" className="pill" data-selected={false}>登录</Link>
        )}
      </nav>
    </header>
  );
}

function Logo() {
  return (
    <div className="relative grid h-9 w-9 place-items-center rounded-full" style={{
      background: "linear-gradient(135deg, #FF9EC4 0%, #C8B6FF 50%, #9DF3D7 100%)",
      boxShadow: "0 8px 18px rgba(157,107,255,0.30), inset 0 1px 0 rgba(255,255,255,0.8)",
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path d="M14.5 11.2A6.5 6.5 0 1 1 7.3 3.5a5.6 5.6 0 0 0 7.2 7.7Z" fill="white" />
      </svg>
    </div>
  );
}
