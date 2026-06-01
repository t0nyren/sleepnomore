# 眠安 (SleepNoMore) — Web Prototype

Next.js 15 + React 19 + Tailwind v4. Phase 0 prototype of visual baseline + 4 core screens.

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Routes (prototype, no backend yet)

| Path | Screen |
|---|---|
| `/` | Tonight — landing, one CTA + recent stories + suggestions |
| `/create` | Create-Guided — theme / style / duration / voice pills |
| `/create/free` | Create-Free — 500-char prompt + style hints |
| `/voices` | Voice Picker — 4 Minimax presets + cloning placeholder |

Persistent mini-player at the bottom of every page.

## Design tokens

All tokens live in `app/globals.css` inside `@theme { ... }`. To tweak the visual baseline, edit there.

Key tokens:
- `--color-bg-base` = `#0B1020` (midnight navy, never pure black)
- `--color-accent-violet/indigo/cyan` — used only in the aurora gradient on the primary CTA + mini-player play button
- `--font-serif` = Noto Serif SC + Cormorant Garamond → display / story titles
- `--font-sans` = Inter + Noto Sans SC → body
- `--ease-quiet` = `cubic-bezier(0.2, 0.8, 0.2, 1)` → all motion

## What this is NOT yet

- No backend / no real generation / no real TTS — all data is hardcoded in components
- No auth, no library persistence, no reader, no real player
- No PWA manifest yet
- Mock data lives inline (will move to `packages/shared` when we extract the monorepo in P1)
