import Link from "next/link";
import { WhiteNoisePlayer } from "../_components/WhiteNoisePlayer";

export default function NoisePage() {
  return (
    <div className="flex flex-col gap-8 pt-4 sm:pt-8">
      <header className="flex flex-col gap-4">
        <span className="chip-bright" style={{ background: "linear-gradient(135deg,#00D1B2,#4FB6FF)" }}>
          WHITE NOISE
        </span>
        <h1 className="display text-h1 max-w-[24ch]">选一段今晚的环境声。</h1>
        <p className="muted max-w-[42ch]">
          雨声、海浪、溪流、篝火、夜虫和风扇都换成真实环境录音，循环播放时可以叠在故事声音下面。
        </p>
      </header>

      <WhiteNoisePlayer />

      <div className="flex flex-wrap gap-3">
        <Link href="/create" className="cta-primary">写一篇故事</Link>
        <Link href="/" className="cta-ghost">回到首页</Link>
      </div>
    </div>
  );
}
