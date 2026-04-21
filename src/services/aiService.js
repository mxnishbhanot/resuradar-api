import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import dotenv from "dotenv";
import { buildAiMetrics, normalizeResumeText, summarizeJobDescription } from "./aiPromptOptimizer.js";
import {
  AI_MAX_OUTPUT_TOKENS,
  resumeAnalysisResponseSchema,
  resumeJobMatchResponseSchema,
  resumeParseResponseSchema,
} from "./aiSchemas.js";
import { aiResponseCacheGet, aiResponseCacheKey, aiResponseCacheSet } from "./aiResponseCache.js";
import {
  normalizePremiumFeedback,
  normalizeJobMatchPremiumFeedback,
  normalizeJobMatchFreeFeedback,
} from "./aiResumeAnalysisPostProcess.js";
import { logger } from "../utils/logger.js";

dotenv.config();

/** Thrown when Gemini returns 429 / RESOURCE_EXHAUSTED (quota or rate limits). */
export class GeminiRateLimitError extends Error {
  constructor() {
    super(
      "Gemini API quota or rate limit was hit. Enable billing on your Google AI / Gemini project, wait for limits to reset, or reduce traffic. See https://ai.google.dev/gemini-api/docs/rate-limits"
    );
    this.name = "GeminiRateLimitError";
    this.code = "GEMINI_RATE_LIMIT";
  }
}

/** Model ID not found or retired for this project (e.g. gemini-2.0-flash-001 for new users). */
export class GeminiModelUnavailableError extends Error {
  constructor() {
    super(
      "The configured Gemini model is not available for this API project. Defaults use gemini-2.5-flash / gemini-2.5-pro; set GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL, or GEMINI_MODEL_PARSE to a model listed at https://ai.google.dev/gemini-api/docs/models"
    );
    this.name = "GeminiModelUnavailableError";
    this.code = "GEMINI_MODEL_UNAVAILABLE";
  }
}

const isGeminiQuotaOrRateLimitError = (err) => {
  const raw = String(err?.message || "");
  if (
    /"code"\s*:\s*429|"status"\s*:\s*"RESOURCE_EXHAUSTED"|RESOURCE_EXHAUSTED|quota exceeded|free_tier|rate limit|rate-limit/i.test(
      raw
    )
  ) {
    return true;
  }
  try {
    const j = JSON.parse(raw);
    const e = j?.error;
    if (e?.code === 429 || e?.status === "RESOURCE_EXHAUSTED") return true;
  } catch {
    /* not JSON */
  }
  return false;
};

const isGeminiModelNotFoundError = (err) => {
  const raw = String(err?.message || "");
  if (/404|"NOT_FOUND"|no longer available|not found for API version/i.test(raw)) return true;
  try {
    const j = JSON.parse(raw);
    const e = j?.error;
    if (e?.code === 404 || e?.status === "NOT_FOUND") return true;
  } catch {
    /* not JSON */
  }
  return false;
};

const shouldSkipSchemalessFallback = (err) =>
  isGeminiQuotaOrRateLimitError(err) || isGeminiModelNotFoundError(err);

const ai = process.env.NODE_ENV === "production"
  ? new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_PROJECT_ID,
      location: process.env.GOOGLE_REGION || "us-central1",
      apiVersion: "v1",
    })
  : new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      apiVersion: "v1alpha",
    });

// gemini-2.0-*-001 is retired for new API projects; 2.5 is the current default family.
// Override with GEMINI_FLASH_MODEL / GEMINI_PRO_MODEL if your region exposes different IDs.
const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || "gemini-2.5-flash";
const PRO_MODEL = process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro";

const useProForAnalysis = () =>
  ["1", "true", "yes"].includes(String(process.env.GEMINI_USE_PRO_FOR_ANALYSIS || "").toLowerCase());

/**
 * Tiered models: Flash for parsing (structured extraction) and for analysis/match by default.
 * Set GEMINI_USE_PRO_FOR_ANALYSIS=1 to use Pro for resume analysis and job match in production.
 */
const getModel = (operation) => {
  if (operation === "parse") {
    return process.env.GEMINI_MODEL_PARSE || FLASH_MODEL;
  }
  if (operation === "analysis" || operation === "match") {
    if (useProForAnalysis()) return PRO_MODEL;
    return process.env.GEMINI_MODEL_ANALYSIS || FLASH_MODEL;
  }
  return FLASH_MODEL;
};

const schemaDisabled = () =>
  ["1", "true", "yes"].includes(String(process.env.AI_DISABLE_JSON_SCHEMA || "").toLowerCase());

const extractJsonText = (response) =>
  response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
  response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
  (typeof response?.text === "string" ? response.text.trim() : "") ||
  "";

/** First top-level `{ ... }` using brace depth (strings + escapes), not greedy last-`}`. */
const extractFirstJsonObject = (str) => {
  const s = String(str || "");
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
};

const parseJsonResponse = (text) => {
  const trimmed = String(text || "").trim();
  const tryParse = (raw) => {
    const s = String(raw || "").trim();
    if (!s) throw new Error("Empty JSON");
    try {
      return JSON.parse(s);
    } catch {
      return JSON.parse(jsonrepair(s));
    }
  };

  try {
    return tryParse(trimmed);
  } catch {
    /* fall through */
  }
  const cleanedText = trimmed.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return tryParse(cleanedText);
  } catch {
    /* fall through */
  }
  const blob = extractFirstJsonObject(cleanedText) || extractFirstJsonObject(trimmed);
  if (!blob) throw new Error("No valid JSON found in AI response");
  try {
    return tryParse(blob);
  } catch (e) {
    throw new Error(`No valid JSON found in AI response: ${e.message}`);
  }
};

const detectField = (text) => {
  const lower = String(text || "").toLowerCase();
  if (/(sales|account manager|crm|quota|pipeline|territory|revenue)/.test(lower)) return "Sales";
  if (/(software|developer|engineer|programming|code|javascript|python|java|react)/.test(lower)) return "Software Engineering";
  if (/(marketing|brand|campaign|seo|content|social media)/.test(lower)) return "Marketing";
  if (/(design|ux|ui|visual|figma|adobe|creative)/.test(lower)) return "Design";
  if (/(finance|accounting|bookkeeping|audit|budget|financial)/.test(lower)) return "Finance";
  if (/(hr|recruitment|human resources|talent acquisition|people operations)/.test(lower)) return "Human Resources";
  if (/(operations|logistics|supply chain|process improvement)/.test(lower)) return "Operations";
  if (/(data|analytics|machine learning|ai|statistics)/.test(lower)) return "Data / Analytics";
  return "General";
};

async function generateStructuredJson({ model, prompt, responseSchema, maxOutputTokens }) {
  if (!schemaDisabled()) {
    try {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens,
        },
      });
    } catch (err) {
      if (shouldSkipSchemalessFallback(err)) {
        logger.warn("Gemini error not recoverable by schema fallback; skipping second request", {
          model,
          reason: isGeminiModelNotFoundError(err) ? "model_not_found" : "quota_or_rate_limit",
        });
        throw err;
      }
      logger.warn("Structured JSON generation failed, retrying without responseSchema", {
        message: err.message,
        model,
      });
      return ai.models.generateContent({
        model,
        contents: prompt,
        config: { maxOutputTokens },
      });
    }
  }

  return ai.models.generateContent({
    model,
    contents: prompt,
    config: { maxOutputTokens },
  });
}

export async function analyzeResume(resumeText) {
  const normalizedResume = normalizeResumeText(resumeText);
  const detectedField = detectField(normalizedResume);
  const model = getModel("analysis");

  const cacheKey = aiResponseCacheKey(["resume-analysis", "v3-enterprise", model, normalizedResume]);
  const cached = aiResponseCacheGet(cacheKey);
  if (cached) {
    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-analysis",
        prompt: "",
        responseText: JSON.stringify(cached),
        durationMs: 0,
        cacheHit: true,
        model,
      })
    );
    return cached;
  }

  const prompt = `
You are an expert resume coach. Analyze this ${detectedField} resume and return JSON only.
Ground every point in the resume text below—no generic career advice unless it clearly applies to what is written.

Rules:
- score: integer 0-100 (holistic resume quality for clarity, impact, and credibility—not a hiring prediction)
- score_explanation: 1-3 sentences; must match the score; plain language; no markdown
- score_factors: 2 to 5 objects; impact must be exactly high, medium, or low; each note one sentence tied to this resume
- summary: 2-4 sentences; only facts and gaps visible in this resume; no markdown
- strengths: 4 to 6 items; each names where on the resume (section/company/project) and why it helps; no vague praise
- improvements: 4 to 6 items; each names where to edit and one concrete next step; do not invent metrics or employers
- detailed_suggestions: 4 to 8 items; EACH item is one complete suggestion (about 80-800 characters); never split one idea across multiple strings
- rewrites: 3 to 6 objects; original must quote or lightly trim a real line/bullet from the resume; suggestion improves it without inventing numbers—use [metric] placeholders if a number would help
- portfolio_tips: 3 to 5 actionable items tied to this candidate's skills/projects when possible
- keywords: only terms relevant to this resume or obvious gaps for the role family; if none add value, use an empty array []
- professional_level: one short phrase describing how the resume reads (e.g. "Mid-level full-stack engineer")—not a job offer or title guarantee
- no markdown anywhere
- Output must be one valid JSON object only: inside string values, escape any double-quote as \\" and use \\n for line breaks (never break a JSON string across physical lines)

Schema:
{
  "score": number,
  "free_feedback": {
    "strengths": [string],
    "improvements": [string],
    "summary": string,
    "score_explanation": string,
    "score_factors": [ { "name": string, "impact": "high"|"medium"|"low", "note": string } ]
  },
  "premium_feedback": {
    "detailed_suggestions": [string],
    "rewrites": [ { "original": string, "suggestion": string } ],
    "portfolio_tips": [string],
    "keywords": [string],
    "professional_level": string
  }
}

Resume text:
${normalizedResume}
`;

  const startedAt = Date.now();

  try {
    const response = await generateStructuredJson({
      model,
      prompt,
      responseSchema: resumeAnalysisResponseSchema,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS.resumeAnalysis,
    });

    const text = extractJsonText(response);
    if (!text) throw new Error("AI returned no text");

    const parsed = parseJsonResponse(text);
    let score = typeof parsed.score === "string" ? parseFloat(parsed.score) : parsed.score;
    if (Number.isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score: ${parsed.score}`);
    }

    if (!parsed.free_feedback || !parsed.premium_feedback) {
      throw new Error("Incomplete AI response");
    }

    const fb = parsed.free_feedback;
    if (typeof fb.score_explanation !== "string" || !fb.score_explanation.trim()) {
      throw new Error("Incomplete AI response: score_explanation");
    }

    const allowedImpact = new Set(["high", "medium", "low"]);
    const rawFactors = Array.isArray(fb.score_factors) ? fb.score_factors : [];
    const score_factors = rawFactors
      .slice(0, 5)
      .map((f) => {
        if (!f || typeof f !== "object") return null;
        const name = typeof f.name === "string" ? f.name.trim() : "";
        const note = typeof f.note === "string" ? f.note.trim() : "";
        const impact = typeof f.impact === "string" ? f.impact.trim().toLowerCase() : "";
        const impactNorm = allowedImpact.has(impact) ? impact : "medium";
        if (!name || !note) return null;
        return { name, impact: impactNorm, note };
      })
      .filter(Boolean);

    score = Math.round(score);

    const free_feedback = {
      ...fb,
      score_explanation: fb.score_explanation.trim(),
      score_factors,
    };

    const result = {
      detected_field: detectedField,
      score,
      free_feedback,
      premium_feedback: normalizePremiumFeedback(parsed.premium_feedback),
    };

    aiResponseCacheSet(cacheKey, result);

    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-analysis",
        prompt,
        responseText: text,
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        model,
      })
    );

    return result;
  } catch (error) {
    logger.error("analyzeResume error", { message: error.message });
    if (isGeminiQuotaOrRateLimitError(error)) throw new GeminiRateLimitError();
    if (isGeminiModelNotFoundError(error)) throw new GeminiModelUnavailableError();
    throw new Error("Failed to analyze resume with Gemini");
  }
}

export async function analyzeResumeToJob(resumeText, jobDescription) {
  const normalizedResume = normalizeResumeText(resumeText);
  const compactJobDescription = summarizeJobDescription(jobDescription);
  const resumeField = detectField(normalizedResume);
  const detectedField = resumeField !== "General" ? resumeField : detectField(compactJobDescription);
  const model = getModel("match");

  const cacheKey = aiResponseCacheKey([
    "resume-job-match",
    "v2-enterprise",
    model,
    normalizedResume,
    compactJobDescription,
  ]);
  const cached = aiResponseCacheGet(cacheKey);
  if (cached) {
    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-job-match",
        prompt: "",
        responseText: JSON.stringify(cached),
        durationMs: 0,
        cacheHit: true,
        model,
      })
    );
    return cached;
  }

  const prompt = `
You are an expert recruiter and resume coach. Compare this resume to the job summary and return JSON only.
Ground every point in the two texts—no invented employers, tools, or metrics that do not appear or clearly follow from the resume and job summary.

Rules:
- match_score: integer 0-100 (alignment of resume to this JD—not a hiring decision)
- match_level: short label consistent with the score (e.g. Strong / Good / Fair / Weak)
- summary: 2-4 sentences; what fits, what is missing, and priority fix; no markdown
- strengths: 3 to 6 items; each must cite resume + JD overlap (skills, titles, domains) when possible
- gaps: 3 to 6 items; each must name a concrete gap vs the JD (missing keyword, missing proof, seniority signal); no vague filler
- keyword_analysis: realistic counts from the job summary vocabulary; missing_keywords only for terms in/near the JD the resume does not show; matched_keywords must not exceed total_keywords_in_jd
- role_fit_breakdown: integers 0-100 per dimension; must align with match_score overall
- recommendations: 4 to 10 items; each one complete actionable sentence; never split one recommendation across multiple array strings
- suggested_rewrites: 3 to 6 pairs; original must quote or lightly trim a real resume line; suggestion improves JD alignment without inventing numbers—use [metric] placeholders if needed
- no markdown
- One valid JSON object only: escape internal double-quotes in strings as \\" and use \\n for newlines (no raw line breaks inside strings)

Schema:
{
  "free_feedback": {
    "match_score": number,
    "match_level": string,
    "summary": string,
    "strengths": [string],
    "gaps": [string]
  },
  "premium_feedback": {
    "keyword_analysis": {
      "total_keywords_in_jd": number,
      "matched_keywords": number,
      "missing_keywords": [string]
    },
    "role_fit_breakdown": {
      "technical_skills_fit": number,
      "experience_fit": number,
      "education_fit": number,
      "soft_skills_fit": number,
      "overall_fit": number
    },
    "recommendations": [string],
    "suggested_rewrites": [
      {
        "original": string,
        "suggestion": string
      }
    ]
  }
}

Role family: ${detectedField}

Job summary:
${compactJobDescription}

Resume text:
${normalizedResume}
`;

  const startedAt = Date.now();

  try {
    const response = await generateStructuredJson({
      model,
      prompt,
      responseSchema: resumeJobMatchResponseSchema,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS.resumeJobMatch,
    });

    const text = extractJsonText(response);
    if (!text) throw new Error("AI returned no text");

    const parsed = parseJsonResponse(text);
    if (!parsed.free_feedback || !parsed.premium_feedback) {
      throw new Error("Missing required AI sections");
    }

    let score = parsed.free_feedback.match_score;
    if (typeof score === "string") score = parseFloat(score);
    if (Number.isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Invalid match_score: ${parsed.free_feedback.match_score}`);
    }

    score = Math.round(score);

    const freeNorm = normalizeJobMatchFreeFeedback(parsed.free_feedback);
    const premiumNorm = normalizeJobMatchPremiumFeedback(parsed.premium_feedback, score);

    const result = {
      detected_field: detectedField,
      match_score: score,
      match_level: freeNorm.match_level,
      free_feedback: {
        ...freeNorm,
        match_score: score,
      },
      premium_feedback: premiumNorm,
    };

    aiResponseCacheSet(cacheKey, result);

    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-job-match",
        prompt,
        responseText: text,
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        model,
      })
    );

    return result;
  } catch (error) {
    logger.error("analyzeResumeToJob error", { message: error.message });
    if (isGeminiQuotaOrRateLimitError(error)) throw new GeminiRateLimitError();
    if (isGeminiModelNotFoundError(error)) throw new GeminiModelUnavailableError();
    throw new Error("Failed to analyze resume-job match with Gemini");
  }
}

export async function parseResumeToSchema(resumeText) {
  const normalizedResume = normalizeResumeText(resumeText);
  const model = getModel("parse");

  const cacheKey = aiResponseCacheKey(["resume-parse", model, normalizedResume]);
  const cached = aiResponseCacheGet(cacheKey);
  if (cached) {
    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-parse",
        prompt: "",
        responseText: JSON.stringify(cached),
        durationMs: 0,
        cacheHit: true,
        model,
      })
    );
    return cached;
  }

  const prompt = `
Extract resume data into JSON only.

Schema:
{
  "personal": {
    "firstName": string,
    "lastName": string,
    "email": string,
    "phone": string,
    "location": string,
    "headline": string,
    "summary": string,
    "linkedin": string,
    "github": string,
    "portfolioUrl": string
  },
  "educations": [
    {
      "school": string,
      "degree": string,
      "field": string,
      "startYear": string,
      "endYear": string,
      "description": string
    }
  ],
  "experiences": [
    {
      "title": string,
      "company": string,
      "startDate": string,
      "endDate": string,
      "isCurrent": boolean,
      "bullets": [string]
    }
  ],
  "skills": [
    {
      "name": string,
      "level": string
    }
  ],
  "projects": [
    {
      "title": string,
      "link": string,
      "description": string,
      "tech": [string]
    }
  ]
}

Use empty strings or empty arrays when missing. No markdown.

Resume text:
${normalizedResume}
`;

  const startedAt = Date.now();

  try {
    const response = await generateStructuredJson({
      model,
      prompt,
      responseSchema: resumeParseResponseSchema,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS.resumeParse,
    });

    const text = extractJsonText(response);
    if (!text) throw new Error("AI returned empty response");

    const parsed = parseJsonResponse(text);
    if (!parsed.personal || !parsed.educations || !parsed.experiences) {
      throw new Error("Incomplete schema in AI response");
    }

    aiResponseCacheSet(cacheKey, parsed);

    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-parse",
        prompt,
        responseText: text,
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        model,
      })
    );

    return parsed;
  } catch (error) {
    logger.error("parseResumeToSchema error", { message: error.message });
    if (isGeminiQuotaOrRateLimitError(error)) throw new GeminiRateLimitError();
    if (isGeminiModelNotFoundError(error)) throw new GeminiModelUnavailableError();
    throw new Error("Failed to parse resume structure with AI");
  }
}
