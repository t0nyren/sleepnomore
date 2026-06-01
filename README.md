# SleepNoMore (眠安)

An AI sleep-story app: generate a calming bedtime story from a prompt or guided theme, listen as audio.

Production: <https://sleepnomore.secondlife.today>

## Monorepo layout

```
apps/
  web/      Next.js 16 app (Tailwind v4, App Router). Production build deploys to /srv/mianan/ via rsync.
  mobile/   Capacitor iOS shell wrapping the production PWA. Bundle id com.sleepnomore.app.
```

See each `apps/<name>/README.md` for setup, build, and deploy notes.

## Quick orientation

- **Source of truth**: this repo. Pull before editing; push before deploy.
- **Production deploy** (web): `rsync apps/web/ root@<server>:/srv/mianan/`, then `npm run build && systemctl restart mianan` on the server. `/srv/mianan/` keeps its flat layout — only the repo is restructured.
- **iOS app**: `apps/mobile/`. Open `ios/App/App.xcodeproj` in Xcode. Loads the production URL inside a WebView; the native shell adds `UIBackgroundModes: audio` and safe-area inset injection so the PWA works as a real app with lock-screen playback.
- **Secrets**: never committed. Web server reads `/etc/mianan/env`. iOS shell has no secrets.

## Owners

- Web (`apps/web/`) — Tio + Altina
- Mobile (`apps/mobile/`) — Tio
- LLM/TTS reliability (`apps/web/lib/adapters/`, `apps/web/lib/prompts/`) — Altina
