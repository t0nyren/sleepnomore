/**
 * Preset story catalog — reads chapter JSON files under
 * `apps/web/content/presets/<series>/<NNN>.json` and exposes a metadata
 * index. Bodies are loaded on demand via `loadChapter` in store.ts.
 *
 * Cached at module load. App restart picks up new chapters.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type PresetChapterMeta = {
  series: string;
  chapter: number;
  title: string;
  originalTitle?: string;
  summary?: string;
  charCount: number;
  estimatedMinutes: number;
  filename: string;
};

export type PresetSeries = {
  id: string;
  name: string;       // 人类可读名（三国演义）
  description?: string;
  chapterCount: number;
  totalChars: number;
};

const SERIES_META: Record<string, { name: string; description?: string }> = {
  sanguo:         { name: "三国演义", description: "罗贯中 · 桃园三结义到三分归晋的英雄长卷" },
  shuihu:         { name: "水浒传",   description: "施耐庵 · 一百零八将聚义梁山的江湖" },
  xiyou:          { name: "西游记",   description: "吴承恩 · 唐三藏师徒西天取经的奇幻路" },
  hongloumeng:    { name: "红楼梦",   description: "曹雪芹 · 大观园里的繁华与苍凉" },
  xingshihengyan: { name: "醒世恒言", description: "冯梦龙 · 醒世人间因果的明代白话短篇" },
  jingshitongyan: { name: "警世通言", description: "冯梦龙 · 警世通言里的市井侠义" },
  yushiming:      { name: "喻世明言", description: "冯梦龙 · 喻世明言中的世情奇谭" },
  chukepaian:     { name: "初刻拍案惊奇", description: "凌濛初 · 一卷拍案叫绝的奇案录" },
  erkepaian:      { name: "二刻拍案惊奇", description: "凌濛初 · 二卷拍案叫绝的奇案录" },
};

function contentRoot(): string {
  // resolve from this file's location: lib/presets/catalog.ts → ../../content/presets
  const here = dirname(fileURLToPath(import.meta.url));
  // dev: apps/web/lib/presets ; build: .next/server/... ; fallback hardcoded
  const candidates = [
    join(here, "..", "..", "content", "presets"),
    join(process.cwd(), "apps", "web", "content", "presets"),
    join(process.cwd(), "content", "presets"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isDirectory()) return c;
  }
  throw new Error("preset content directory not found; tried: " + candidates.join(", "));
}

type Catalog = {
  series: PresetSeries[];
  chapters: PresetChapterMeta[];
  bySeries: Record<string, PresetChapterMeta[]>;
};

let _catalog: Catalog | null = null;

export function getCatalog(): Catalog {
  if (_catalog) return _catalog;
  _catalog = loadCatalog();
  return _catalog;
}

function loadCatalog(): Catalog {
  const root = contentRoot();
  const seriesDirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !name.startsWith("_") && !name.startsWith("."));

  const allChapters: PresetChapterMeta[] = [];
  const bySeries: Record<string, PresetChapterMeta[]> = {};
  const seriesList: PresetSeries[] = [];

  for (const series of seriesDirs) {
    const dir = join(root, series);
    const files = readdirSync(dir)
      .filter((f) => /^\d{3,}\.json$/.test(f))
      .sort();
    const chapters: PresetChapterMeta[] = [];
    let totalChars = 0;
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), "utf8");
        const parsed = JSON.parse(raw);
        const meta: PresetChapterMeta = {
          series,
          chapter: parsed.chapter,
          title: parsed.title,
          originalTitle: parsed.originalTitle,
          summary: parsed.summary,
          charCount: parsed.charCount ?? (parsed.body ? parsed.body.length : 0),
          estimatedMinutes: parsed.estimatedMinutes ?? Math.max(1, Math.round((parsed.charCount ?? 2500) / 280)),
          filename: file,
        };
        chapters.push(meta);
        totalChars += meta.charCount;
      } catch (err) {
        // skip malformed, log but don't fail the whole catalog
        console.warn(`[presets] skip ${series}/${file}: ${(err as Error).message}`);
      }
    }
    if (chapters.length === 0) continue;
    chapters.sort((a, b) => a.chapter - b.chapter);
    bySeries[series] = chapters;
    allChapters.push(...chapters);
    seriesList.push({
      id: series,
      name: SERIES_META[series]?.name ?? series,
      description: SERIES_META[series]?.description,
      chapterCount: chapters.length,
      totalChars,
    });
  }

  // 按 SERIES_META 顺序展示
  const order = Object.keys(SERIES_META);
  seriesList.sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return a.id.localeCompare(b.id);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return { series: seriesList, chapters: allChapters, bySeries };
}

export function getSeries(seriesId: string): PresetSeries | null {
  return getCatalog().series.find((s) => s.id === seriesId) ?? null;
}

export function getSeriesChapters(seriesId: string): PresetChapterMeta[] {
  return getCatalog().bySeries[seriesId] ?? [];
}

export function getChapterMeta(seriesId: string, chapter: number): PresetChapterMeta | null {
  const list = getCatalog().bySeries[seriesId];
  if (!list) return null;
  return list.find((c) => c.chapter === chapter) ?? null;
}

export function contentRootPath(): string {
  return contentRoot();
}
