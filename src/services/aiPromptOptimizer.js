import crypto from "crypto";

const MAX_RESUME_CHARS = 6000;
const MAX_JOB_DESCRIPTION_CHARS = 3500;

/** LRU + TTL cache for derived job-description summaries (bounded memory). */
class LruTtlCache {
  constructor(maxEntries, ttlMs) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    /** @type {Map<string, { value: string, expiresAt: number }>} */
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
}

const jdSummaryMaxEntries = Math.max(50, Number(process.env.JD_SUMMARY_CACHE_MAX_ENTRIES || 500));
const jdSummaryTtlMs = Math.max(60_000, Number(process.env.JD_SUMMARY_CACHE_TTL_MS || 3_600_000));
const jdSummaryCache = new LruTtlCache(jdSummaryMaxEntries, jdSummaryTtlMs);

const linesFromText = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const dedupeLines = (lines) => {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const weight = (line) => {
  const lower = line.toLowerCase();
  if (/summary|profile|experience|employment|skills|projects|education/.test(lower)) return 3;
  if (/[0-9]{4}|%|\$|improved|built|managed|designed|developed/.test(lower)) return 2;
  return 1;
};

const trimToBudget = (lines, maxChars) => {
  const prioritized = [...lines].sort((a, b) => weight(b) - weight(a));
  const chosen = [];
  let length = 0;

  for (const line of prioritized) {
    if (length + line.length + 1 > maxChars) continue;
    chosen.push(line);
    length += line.length + 1;
  }

  return chosen.join("\n");
};

const hashInput = (...parts) =>
  crypto.createHash("sha256").update(parts.join("::")).digest("hex");

export const normalizeResumeText = (resumeText) => {
  const lines = dedupeLines(linesFromText(resumeText));
  return trimToBudget(lines, MAX_RESUME_CHARS);
};

export const summarizeJobDescription = (jobDescription) => {
  const key = hashInput("job-description", jobDescription);
  const hit = jdSummaryCache.get(key);
  if (hit !== undefined) return hit;

  const lines = dedupeLines(linesFromText(jobDescription));
  const skills = [];
  const qualifications = [];
  const responsibilities = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/required|must|qualification|degree|experience/.test(lower)) {
      qualifications.push(line);
      continue;
    }
    if (/skill|tool|stack|react|angular|node|mongodb|javascript|typescript|api|aws|docker|sql/.test(lower)) {
      skills.push(line);
      continue;
    }
    responsibilities.push(line);
  }

  const summary = [
    "Key skills:",
    ...skills.slice(0, 8),
    "Qualifications:",
    ...qualifications.slice(0, 6),
    "Responsibilities:",
    ...responsibilities.slice(0, 8),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_JOB_DESCRIPTION_CHARS);

  const value = summary || trimToBudget(lines, MAX_JOB_DESCRIPTION_CHARS);
  jdSummaryCache.set(key, value);
  return value;
};

export const estimateTokenCount = (text) => Math.ceil(String(text || "").length / 4);

export const buildAiMetrics = ({ operation, prompt, responseText, durationMs, cacheHit = false, model }) => ({
  operation,
  model,
  promptChars: prompt.length,
  promptTokensEstimate: estimateTokenCount(prompt),
  responseChars: String(responseText || "").length,
  responseTokensEstimate: estimateTokenCount(responseText || ""),
  durationMs,
  cacheHit,
});
