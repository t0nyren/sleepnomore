#!/usr/bin/env node
/**
 * Preset story validator.
 *
 * Usage:
 *   node scripts/validate-presets.mjs <seriesId> [--fix]
 *
 * Examples:
 *   node scripts/validate-presets.mjs sanguo
 *   node scripts/validate-presets.mjs sanguo --fix
 *
 * Validates every NNN.json under content/presets/<seriesId>/:
 *   - required schema fields present
 *   - chapter number matches filename
 *   - originalTitle matches _toc.json entry
 *   - body charCount within bounds (hard 2200-3300, soft 2400-3100)
 *   - charCount / estimatedMinutes derived fields consistent
 *
 * With --fix:
 *   - rewrites charCount + estimatedMinutes to derived values
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = dirname(__dirname);

const HARD_MIN = 2200;
const HARD_MAX = 3300;
const SOFT_MIN = 2400;
const SOFT_MAX = 3100;
const CHARS_PER_MINUTE = 200;

const REQUIRED_FIELDS = [
  "schemaVersion",
  "seriesId",
  "chapter",
  "title",
  "originalTitle",
  "summary",
  "body",
  "author",
  "createdAt",
];

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function warn(msg) {
  console.warn(`WARN  ${msg}`);
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");
  const seriesId = args.find((a) => !a.startsWith("--"));

  if (!seriesId) {
    console.error("usage: validate-presets.mjs <seriesId> [--fix]");
    process.exit(2);
  }

  const seriesDir = join(WEB_ROOT, "content", "presets", seriesId);
  if (!existsSync(seriesDir)) {
    console.error(`series dir not found: ${seriesDir}`);
    process.exit(2);
  }

  const seriesFile = join(seriesDir, "series.json");
  if (!existsSync(seriesFile)) {
    fail(`missing series.json in ${seriesDir}`);
    process.exit(1);
  }
  const series = JSON.parse(readFileSync(seriesFile, "utf8"));
  ok(`series "${series.title}" (${series.totalChapters} chapters)`);

  const tocFile = join(seriesDir, series.tocFile ?? "_toc.json");
  if (!existsSync(tocFile)) {
    fail(`missing toc file ${tocFile}`);
    process.exit(1);
  }
  const toc = JSON.parse(readFileSync(tocFile, "utf8"));
  const tocMap = new Map(toc.chapters.map((c) => [c.chapter, c.originalTitle]));
  if (tocMap.size !== series.totalChapters) {
    fail(
      `toc has ${tocMap.size} chapters but series.totalChapters = ${series.totalChapters}`,
    );
  }

  const files = readdirSync(seriesDir)
    .filter((f) => /^\d{3}\.json$/.test(f))
    .sort();

  if (files.length === 0) {
    warn(`no chapter files yet in ${seriesDir}`);
    return;
  }

  let chapters = 0;
  let warnings = 0;
  let errors = 0;
  let totalChars = 0;

  for (const file of files) {
    const expectedChapter = parseInt(file.slice(0, 3), 10);
    const path = join(seriesDir, file);
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch (e) {
      fail(`${file}: cannot read: ${e.message}`);
      errors++;
      continue;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      fail(`${file}: invalid JSON: ${e.message}`);
      errors++;
      continue;
    }

    const issues = [];
    for (const f of REQUIRED_FIELDS) {
      if (data[f] === undefined || data[f] === null || data[f] === "") {
        issues.push(`missing field "${f}"`);
      }
    }
    if (data.seriesId !== seriesId) {
      issues.push(`seriesId="${data.seriesId}" but expected "${seriesId}"`);
    }
    if (data.chapter !== expectedChapter) {
      issues.push(
        `chapter=${data.chapter} but filename implies ${expectedChapter}`,
      );
    }
    const expectedTitle = tocMap.get(expectedChapter);
    if (expectedTitle && data.originalTitle !== expectedTitle) {
      issues.push(
        `originalTitle does not match toc:\n      file: ${data.originalTitle}\n      toc:  ${expectedTitle}`,
      );
    }

    if (issues.length > 0) {
      for (const i of issues) fail(`${file}: ${i}`);
      errors += issues.length;
      continue;
    }

    const realCount = [...data.body].length;
    const realMinutes = Math.round(realCount / CHARS_PER_MINUTE);
    totalChars += realCount;

    if (realCount < HARD_MIN || realCount > HARD_MAX) {
      fail(`${file}: charCount=${realCount} outside hard range [${HARD_MIN}, ${HARD_MAX}]`);
      errors++;
    } else if (realCount < SOFT_MIN || realCount > SOFT_MAX) {
      warn(`${file}: charCount=${realCount} outside soft range [${SOFT_MIN}, ${SOFT_MAX}] — review`);
      warnings++;
    }

    if (fix) {
      let changed = false;
      if (data.charCount !== realCount) {
        data.charCount = realCount;
        changed = true;
      }
      if (data.estimatedMinutes !== realMinutes) {
        data.estimatedMinutes = realMinutes;
        changed = true;
      }
      if (changed) {
        writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
        ok(`${file}: fixed (charCount=${realCount}, estimatedMinutes=${realMinutes})`);
      } else {
        ok(`${file}: ch.${data.chapter} "${data.title}" — ${realCount} chars / ${realMinutes} min`);
      }
    } else {
      if (data.charCount !== undefined && data.charCount !== realCount) {
        fail(
          `${file}: stored charCount=${data.charCount} does not match body length ${realCount}; run with --fix`,
        );
        errors++;
      }
      if (
        data.estimatedMinutes !== undefined &&
        data.estimatedMinutes !== realMinutes
      ) {
        warn(
          `${file}: estimatedMinutes=${data.estimatedMinutes} but derived is ${realMinutes}; run with --fix`,
        );
        warnings++;
      }
      ok(`${file}: ch.${data.chapter} "${data.title}" — ${realCount} chars / ${realMinutes} min`);
    }

    chapters++;
  }

  console.log("");
  console.log(`---`);
  console.log(`series:    ${series.title}`);
  console.log(`chapters:  ${chapters} / ${series.totalChapters}`);
  console.log(`avg chars: ${chapters > 0 ? Math.round(totalChars / chapters) : 0}`);
  console.log(`warnings:  ${warnings}`);
  console.log(`errors:    ${errors}`);

  if (errors > 0) process.exitCode = 1;
}

main();
