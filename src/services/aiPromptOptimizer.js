import crypto from "crypto";

const cache = new Map();
const MAX_RESUME_CHARS = 6000;
const MAX_JOB_DESCRIPTION_CHARS = 3500;

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
  if (cache.has(key)) return cache.get(key);

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
  cache.set(key, value);
  return value;
};

export const estimateTokenCount = (text) => Math.ceil(String(text || "").length / 4);

export const buildAiMetrics = ({ operation, prompt, responseText, durationMs, cacheHit = false }) => ({
  operation,
  promptChars: prompt.length,
  promptTokensEstimate: estimateTokenCount(prompt),
  responseChars: String(responseText || "").length,
  responseTokensEstimate: estimateTokenCount(responseText || ""),
  durationMs,
  cacheHit,
});
