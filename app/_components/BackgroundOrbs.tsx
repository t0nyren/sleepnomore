export function BackgroundOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <Orb className="-left-20 top-[6%] h-[440px] w-[440px]" color="#FF9EC4" delay={0} />
      <Orb className="right-[-8%] top-[18%] h-[520px] w-[520px]" color="#A2E4FF" delay={2} />
      <Orb className="left-[28%] top-[55%] h-[500px] w-[500px]" color="#FFD668" delay={4} />
      <Orb className="right-[20%] bottom-[-10%] h-[420px] w-[420px]" color="#C8B6FF" delay={6} />
      <Orb className="left-[-6%] bottom-[8%] h-[380px] w-[380px]" color="#9DF3D7" delay={8} />
    </div>
  );
}

function Orb({ className, color, delay }: { className: string; color: string; delay: number }) {
  return (
    <div
      className={`absolute rounded-full ${className}`}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${color}cc, ${color}33 55%, transparent 75%)`,
        filter: "blur(60px)",
        animation: `orb-float 18s ease-in-out ${delay}s infinite`,
        opacity: 0.85,
      }}
    />
  );
}
