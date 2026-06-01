/**
 * LLM adapter for 眠安 — story generation (incremental streaming).
 *
 * 2026-05-31 v0.3: Stream-parses the JSON `chapters` array so the pipeline
 * can persist + synthesize each chapter the moment its closing `}` arrives,
 * rather than waiting for the whole story to land. Cuts time-to-first-text
 * from ~120s to ~30-60s.
 *
 * Endpoint: ikuncode.cc OpenAI-compatible /v1/chat/completions
 * Creds:    ~/.openai/credentials or OPENAI_BASE_URL + OPENAI_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { STORY_SYSTEM_PROMPT, buildUserPrompt, type StoryParams } from "../prompts/story";

export const ChapterSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
});

export const StorySchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  chapters: z.array(ChapterSchema).min(1),
});

export type Story = z.infer<typeof StorySchema>;
export type Chapter = z.infer<typeof ChapterSchema>;

const DEFAULT_MODEL = process.env.MIANAN_LLM_MODEL || "gpt-5.4";
const DEFAULT_TIMEOUT_MS = parseInt(process.env.MIANAN_LLM_TIMEOUT_MS ?? "180000", 10);

type LLMProviderConfig = {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  protocol: "chat-completions" | "openai-responses";
};

function loadPrimaryProvider(model: string): LLMProviderConfig {
  let baseURL = process.env.OPENAI_BASE_URL;
  let apiKey = process.env.OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    const p = join(homedir(), ".openai", "credentials");
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8");
      baseURL = baseURL ?? raw.match(/base_url\s*=\s*(\S+)/i)?.[1];
      apiKey = apiKey ?? raw.match(/api_key\s*=\s*(\S+)/i)?.[1];
    }
  }
  if (!baseURL || !apiKey) {
    throw new Error("LLM creds missing: set OPENAI_BASE_URL + OPENAI_API_KEY or write ~/.openai/credentials");
  }
  return {
    name: "primary",
    baseURL,
    apiKey,
    model,
    protocol: parseProtocol(process.env.MIANAN_LLM_PROTOCOL, "chat-completions"),
  };
}

function loadFallbackProvider(): LLMProviderConfig | null {
  const baseURL = process.env.MIANAN_LLM_FALLBACK_BASE_URL;
  const apiKey = process.env.MIANAN_LLM_FALLBACK_API_KEY;
  const model = process.env.MIANAN_LLM_FALLBACK_MODEL;
  if (!baseURL && !apiKey && !model) return null;
  if (!baseURL || !apiKey || !model) {
    console.error("[llm] fallback ignored: set all of MIANAN_LLM_FALLBACK_BASE_URL, MIANAN_LLM_FALLBACK_API_KEY, MIANAN_LLM_FALLBACK_MODEL");
    return null;
  }
  return {
    name: "fallback",
    baseURL,
    apiKey,
    model,
    protocol: parseProtocol(process.env.MIANAN_LLM_FALLBACK_PROTOCOL, "chat-completions"),
  };
}

function parseProtocol(value: string | undefined, fallback: LLMProviderConfig["protocol"]): LLMProviderConfig["protocol"] {
  if (!value) return fallback;
  if (value === "chat-completions" || value === "openai-responses") return value;
  console.error(`[llm] unknown protocol ${value}; using ${fallback}`);
  return fallback;
}

/**
 * StoryStreamParser walks the streamed JSON output and emits semantic events:
 *   - story title (once, as soon as the first "title" string field closes)
 *   - story summary (once)
 *   - each chapter object (as its closing `}` arrives inside the chapters array)
 *
 * The parser is escape- and brace-depth aware. It doesn't construct the whole
 * tree — it only tracks enough state to know "am I inside the chapters array,
 * and is the current `{` a chapter object opening?"
 */
type StreamCallbacks = {
  onTitle?: (title: string) => void;
  onSummary?: (summary: string) => void;
  onChapter?: (chapter: Chapter, indexInArray: number) => void;
  onCharCount?: (chars: number) => void;
};

class StoryStreamParser {
  private buf = "";
  private cursor = 0;
  private inString = false;
  private escape = false;
  private depth = 0;
  private inChapters = false;
  private chaptersDepth = 0;
  private chapStart = -1;
  private chapterIdx = 0;
  private titleEmitted = false;
  private summaryEmitted = false;

  feed(chunk: string, cb: StreamCallbacks) {
    this.buf += chunk;
    cb.onCharCount?.(this.buf.length);

    while (this.cursor < this.buf.length) {
      const c = this.buf[this.cursor];

      if (this.escape) {
        this.escape = false;
        this.cursor++;
        continue;
      }
      if (this.inString) {
        if (c === "\\") {
          this.escape = true;
          this.cursor++;
          continue;
        }
        if (c === '"') {
          this.inString = false;
        }
        this.cursor++;
        continue;
      }
      if (c === '"') {
        this.inString = true;
        this.cursor++;
        continue;
      }

      if (c === "{") {
        if (this.inChapters && this.depth === this.chaptersDepth) {
          this.chapStart = this.cursor;
        }
        this.depth++;
      } else if (c === "}") {
        this.depth--;
        if (this.inChapters && this.depth === this.chaptersDepth && this.chapStart !== -1) {
          const chapStr = this.buf.slice(this.chapStart, this.cursor + 1);
          try {
            const ch = JSON.parse(chapStr) as Chapter;
            if (ch?.title && ch?.text) {
              cb.onChapter?.(ch, this.chapterIdx);
              this.chapterIdx++;
            }
          } catch {
            // best-effort — skip malformed
          }
          this.chapStart = -1;
        }
      } else if (c === "[") {
        // Did we just enter the chapters array? Look back for "chapters":
        if (!this.inChapters) {
          const back = this.buf.slice(Math.max(0, this.cursor - 80), this.cursor);
          if (/"chapters"\s*:\s*$/.test(back)) {
            this.inChapters = true;
            this.chaptersDepth = this.depth;
          }
        }
      }

      this.cursor++;
    }

    // Attempt title/summary extraction (only valid before chapters array starts)
    if (!this.titleEmitted) {
      const chapAt = this.buf.indexOf('"chapters"');
      const m = this.buf.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m && m.index !== undefined && (chapAt === -1 || m.index < chapAt)) {
        try {
          const value = JSON.parse('"' + m[1] + '"') as string;
          cb.onTitle?.(value);
          this.titleEmitted = true;
        } catch {
          // wait for more
        }
      }
    }
    if (!this.summaryEmitted) {
      const chapAt = this.buf.indexOf('"chapters"');
      const m = this.buf.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m && m.index !== undefined && (chapAt === -1 || m.index < chapAt)) {
        try {
          const value = JSON.parse('"' + m[1] + '"') as string;
          cb.onSummary?.(value);
          this.summaryEmitted = true;
        } catch {
          // wait
        }
      }
    }
  }

  rawText(): string {
    return this.buf;
  }
}

type LLMStreamMeta = {
  rawChars: number;
  chunks: number;
  finishReason: string | null;
  tailSample: string;
  provider: string;
  model: string;
};

async function postChatStream(
  provider: LLMProviderConfig,
  body: Record<string, unknown>,
  onDelta: (chunk: string) => void,
): Promise<LLMStreamMeta> {
  const timeoutMs = Number.isFinite(DEFAULT_TIMEOUT_MS) && DEFAULT_TIMEOUT_MS > 0 ? DEFAULT_TIMEOUT_MS : 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  const endpoint = provider.protocol === "openai-responses" ? "responses" : "chat/completions";
  const requestBody =
    provider.protocol === "openai-responses"
      ? toResponsesBody(provider, body)
      : { ...body, model: provider.model, stream: true };
  try {
    res = await fetch(`${provider.baseURL}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") throw new Error("LLM_TIMEOUT");
    throw err;
  }
  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const errBody = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }

  let total = 0;
  let chunks = 0;
  let finishReason: string | null = null;
  let buf = "";
  let rawTail = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, { stream: true });
      buf += decoded;
      rawTail = (rawTail + decoded).slice(-400);

      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          clearTimeout(timer);
          return { rawChars: total, chunks, finishReason, tailSample: rawTail, provider: provider.name, model: provider.model };
        }
        let json: any;
        try {
          json = JSON.parse(payload);
        } catch {
          // skip malformed sse
          continue;
        }
        if (json?.type === "response.failed") {
          throw new Error(`LLM response failed: ${json?.response?.error?.message ?? "unknown"}`);
        }
        const choice = json?.choices?.[0];
        const delta =
          provider.protocol === "openai-responses"
            ? json?.type === "response.output_text.delta"
              ? json?.delta
              : undefined
            : choice?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          total += delta.length;
          chunks++;
          onDelta(delta);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (json?.type === "response.completed") finishReason = json?.response?.status ?? "completed";
      }
    }
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") throw new Error("LLM_TIMEOUT");
    throw err;
  } finally {
    clearTimeout(timer);
  }
  return { rawChars: total, chunks, finishReason, tailSample: rawTail, provider: provider.name, model: provider.model };
}

function toResponsesBody(provider: LLMProviderConfig, body: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return {
    model: provider.model,
    stream: true,
    store: false,
    temperature: body.temperature,
    max_output_tokens: body.max_tokens,
    input: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
  };
}

export type GenerateOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  mock?: boolean;
  callbacks?: StreamCallbacks;
};

/**
 * Generate a story while emitting incremental events. The promise resolves
 * when the LLM stream finishes; final story is returned for a sanity check.
 * Empty-stream auto-retry kept from v0.2.
 */
export async function generateStory(
  params: StoryParams,
  opts: GenerateOptions = {},
): Promise<Story> {
  if (opts.mock || process.env.MIANAN_MOCK === "1") {
    const mock = mockStory(params);
    opts.callbacks?.onTitle?.(mock.title);
    opts.callbacks?.onSummary?.(mock.summary);
    mock.chapters.forEach((c, i) => opts.callbacks?.onChapter?.(c, i));
    return mock;
  }

  const userPrompt = buildUserPrompt(params);
  const model = opts.model ?? DEFAULT_MODEL;
  const primary = loadPrimaryProvider(model);
  const fallback = loadFallbackProvider();
  const providers = fallback ? [primary, fallback] : [primary];
  const requestBody = {
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? Math.max(4096, params.durationMin * 1000),
    messages: [
      { role: "system", content: STORY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  };

  // Retry policy:
  //  - On network failure (fetch failed / socket closed) BEFORE any chapter
  //    has been emitted to the caller → safe to retry from scratch
  //  - On network failure AFTER chapters emitted → bail (UI already shows
  //    partial content; we cannot re-emit without breaking Altina's
  //    "已展示前文不能被后续改写" invariant)
  //  - On empty stream (no content arrived) → retry once
  //  - On JSON parse failure (model returned malformed) → no retry, throw

  let chaptersEmittedThisRun = 0;
  const wrappedCallbacks: StreamCallbacks = {
    ...opts.callbacks,
    onChapter: (ch, idx) => {
      chaptersEmittedThisRun++;
      opts.callbacks?.onChapter?.(ch, idx);
    },
  };

  const tryOnce = async (provider: LLMProviderConfig): Promise<{ story: Story | null; meta: LLMStreamMeta; raw: string }> => {
    chaptersEmittedThisRun = 0;
    const parser = new StoryStreamParser();
    const meta = await postChatStream(provider, requestBody, (delta) => {
      parser.feed(delta, wrappedCallbacks);
    });
    const raw = parser.rawText();
    if (!raw) return { story: null, meta, raw };
    try {
      const parsed = JSON.parse(stripCodeFences(raw));
      return { story: StorySchema.parse(parsed), meta, raw };
    } catch {
      return { story: null, meta, raw };
    }
  };

  // ikuncode.cc relay observed empty-stream rate ~50% per call → 3 attempts
  // brings tail user failure from 25% (2 attempts) to ~12%. Backoff: 1.5s, 3s.
  const MAX_ATTEMPTS = 3;
  const BACKOFFS_MS = [1500, 3000];

  for (const provider of providers) {
    const maxAttempts = provider.name === "primary" ? MAX_ATTEMPTS : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await tryOnce(provider);
        if (result.raw && result.story) {
          if (provider.name !== "primary") {
            console.log(`[llm] fallback succeeded with model=${provider.model}`);
          }
          return result.story;
        }
        if (!result.raw) {
          console.error(
            `[llm] empty stream provider=${provider.name} model=${provider.model} attempt ${attempt}/${maxAttempts}; chunks=${result.meta.chunks} finish=${result.meta.finishReason} tail=${JSON.stringify(result.meta.tailSample)}`,
          );
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt - 1]));
            continue;
          }
          if (provider.name === "primary" && fallback) {
            console.error(`[llm] primary exhausted with empty stream; switching to fallback model=${fallback.model}`);
            break;
          }
          throw new Error("LLM_EMPTY");
        }
        // raw present but not parseable
        console.error(`[llm] JSON parse / schema check failed provider=${provider.name} model=${provider.model}; first 500 chars: ${result.raw.slice(0, 500)}`);
        throw new Error("LLM_BAD_JSON");
      } catch (err: any) {
        const code = err?.message ?? String(err);
        const isNet = code === "fetch failed" || code === "LLM_TIMEOUT" || code.includes("ECONNRESET") || code.includes("socket") || code.includes("UND_ERR") || code.includes("HTTP 5");
        if (chaptersEmittedThisRun > 0) {
          console.error(`[llm] mid-stream failure provider=${provider.name} model=${provider.model} after ${chaptersEmittedThisRun} chapters: ${code}`);
          throw err;
        }
        if (isNet && attempt < maxAttempts) {
          console.error(`[llm] retryable error provider=${provider.name} model=${provider.model} attempt ${attempt}/${maxAttempts}: ${code} — retrying`);
          await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt - 1] ?? 3000));
          continue;
        }
        if (isNet && provider.name === "primary" && fallback) {
          console.error(`[llm] primary retryable failure exhausted: ${code}; switching to fallback model=${fallback.model}`);
          break;
        }
        throw err;
      }
    }
  }
  throw new Error("LLM_EMPTY");
}

function stripCodeFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function mockStory(params: StoryParams): Story {
  const theme = params.mode === "guided" ? params.theme : "自由";
  const chapters =
    params.durationMin <= 10 ? 2 : params.durationMin <= 15 ? 3 : params.durationMin <= 20 ? 4 : 5;
  return {
    title: `[mock] ${theme}主题故事`,
    summary: "这是用于离线测试的占位故事。",
    chapters: Array.from({ length: chapters }, (_, i) => ({
      title: `第 ${i + 1} 章`,
      text: `这是第 ${i + 1} 章的占位文本。\n\n夜色慢慢沉下来，远处的山影只剩一线轮廓。${"…".repeat(20)}`,
    })),
  };
}
