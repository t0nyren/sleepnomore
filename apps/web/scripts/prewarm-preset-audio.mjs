#!/usr/bin/env node
/**
 * Pre-warm TTS audio cache for preset chapters.
 *
 * Usage:
 *   node scripts/prewarm-preset-audio.mjs <series> <chapter> <voiceId>
 *   node scripts/prewarm-preset-audio.mjs --all-first-chapters <voiceId>
 *   node scripts/prewarm-preset-audio.mjs --series <series> --voice <voiceId>
 *
 * Examples:
 *   # Warm sanguo chapter 1 with v_jingying voice
 *   node scripts/prewarm-preset-audio.mjs sanguo 1 v_jingying
 *
 *   # Warm first chapter of every series with v_jingying
 *   node scripts/prewarm-preset-audio.mjs --all-first-chapters v_jingying
 *
 *   # Warm all chapters of sanguo with v_jingying (heavy! checks daily quota)
 *   node scripts/prewarm-preset-audio.mjs --series sanguo --voice v_jingying
 *
 * The script imports the same lib/presets/store helpers as the API, so cache
 * keys match exactly — a warm hit at API serve time is guaranteed.
 *
 * Run from /srv/mianan on the prod server (where env vars are loaded by
 * mianan.service). Locally you need to source ~/.tencent + ~/.minimax + the
 * MIANAN_DATA env var.
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoWebRoot = path.resolve(here, "..");

async function importTs(relPath) {
  // The script is normally run on the prod server where the compiled .next
  // ships JS for these libs. Fall back to source via TS-Node-style dynamic
  // import is not necessary here — Node 24+ can import .ts via tsx loader,
  // but the simpler path on prod is: invoke from /srv/mianan after `npm run
  // build`, and load from the compiled server bundle.
  //
  // For dev use, we expect this script to be invoked via:
  //   npx tsx scripts/prewarm-preset-audio.mjs ...
  // tsx will resolve TS files automatically.
  const url = pathToFileURL(path.join(repoWebRoot, relPath)).href;
  return import(url);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--all-first-chapters") {
    return { mode: "first-chapters", voiceId: argv[1] };
  }
  if (argv[0] === "--series") {
    const series = argv[1];
    const voiceFlag = argv.indexOf("--voice");
    const voiceId = voiceFlag >= 0 ? argv[voiceFlag + 1] : null;
    return { mode: "series", series, voiceId };
  }
  if (argv.length === 3) {
    return { mode: "single", series: argv[0], chapter: parseInt(argv[1], 10), voiceId: argv[2] };
  }
  return null;
}

async function main() {
  const args = parseArgs();
  if (!args) {
    console.error("Usage: see file header for examples");
    process.exit(2);
  }

  const { getOrCreateAudio } = await importTs("lib/presets/store.ts");
  const { getCatalog, getSeriesChapters } = await importTs("lib/presets/catalog.ts");

  let jobs = [];
  if (args.mode === "single") {
    jobs.push({ series: args.series, chapter: args.chapter, voiceId: args.voiceId });
  } else if (args.mode === "first-chapters") {
    const cat = getCatalog();
    for (const s of cat.series) {
      jobs.push({ series: s.id, chapter: 1, voiceId: args.voiceId });
    }
  } else if (args.mode === "series") {
    const chapters = getSeriesChapters(args.series);
    for (const c of chapters) {
      jobs.push({ series: args.series, chapter: c.chapter, voiceId: args.voiceId });
    }
  }

  console.log(`prewarm: ${jobs.length} job(s) queued`);
  let hits = 0, misses = 0, fails = 0;
  for (const j of jobs) {
    try {
      const r = await getOrCreateAudio(j.series, j.chapter, j.voiceId);
      if (r.cacheHit) {
        hits += 1;
        console.log(`HIT  ${j.series}/${String(j.chapter).padStart(3, "0")} ${j.voiceId}`);
      } else {
        misses += 1;
        console.log(`WARM ${j.series}/${String(j.chapter).padStart(3, "0")} ${j.voiceId} → ${r.key}`);
      }
    } catch (err) {
      fails += 1;
      console.error(`FAIL ${j.series}/${String(j.chapter).padStart(3, "0")} ${j.voiceId}: ${err.message}`);
      if (err.message?.includes("usage limit") || err.message?.includes("2056")) {
        console.error("  daily TTS quota exhausted; stopping early");
        break;
      }
    }
  }
  console.log(`done: hits=${hits} misses=${misses} fails=${fails}`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
