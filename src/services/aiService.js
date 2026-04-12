import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { buildAiMetrics, normalizeResumeText, summarizeJobDescription } from "./aiPromptOptimizer.js";
import { logger } from "../utils/logger.js";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";

const ai = isProd
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

const getModel = () => (isProd ? "gemini-2.0-pro-001" : "gemini-2.0-flash-001");

const extractJsonText = (response) =>
  response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
  response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
  "";

const parseJsonResponse = (text) => {
  const cleanedText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No valid JSON found in AI response");
  return JSON.parse(jsonMatch[0]);
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

export async function analyzeResume(resumeText) {
  const normalizedResume = normalizeResumeText(resumeText);
  const detectedField = detectField(normalizedResume);

  const prompt = `
Analyze this ${detectedField} resume and return JSON only.

Requirements:
- concise but accurate
- score must be 0-100
- no markdown

Schema:
{
  "score": number,
  "free_feedback": {
    "strengths": [string],
    "improvements": [string],
    "summary": string
  },
  "premium_feedback": {
    "detailed_suggestions": [string],
    "rewrites": [string],
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
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt,
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

    score = Math.round(score);

    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-analysis",
        prompt,
        responseText: text,
        durationMs: Date.now() - startedAt,
      })
    );

    return {
      detected_field: detectedField,
      score,
      free_feedback: parsed.free_feedback,
      premium_feedback: parsed.premium_feedback,
    };
  } catch (error) {
    logger.error("analyzeResume error", { message: error.message });
    throw new Error("Failed to analyze resume with Gemini");
  }
}

export async function analyzeResumeToJob(resumeText, jobDescription) {
  const normalizedResume = normalizeResumeText(resumeText);
  const compactJobDescription = summarizeJobDescription(jobDescription);
  const detectedField =
    detectField(normalizedResume) !== "General"
      ? detectField(normalizedResume)
      : detectField(compactJobDescription);

  const prompt = `
Compare this resume to the job summary and return JSON only.

Rules:
- match_score must be 0-100
- no markdown
- keep recommendations specific

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
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt,
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
    parsed.premium_feedback.role_fit_breakdown = parsed.premium_feedback.role_fit_breakdown || {};
    parsed.premium_feedback.role_fit_breakdown.overall_fit = score;

    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-job-match",
        prompt,
        responseText: text,
        durationMs: Date.now() - startedAt,
      })
    );

    return {
      detected_field: detectedField,
      match_score: score,
      match_level: parsed.free_feedback.match_level,
      free_feedback: {
        ...parsed.free_feedback,
        match_score: score,
      },
      premium_feedback: parsed.premium_feedback,
    };
  } catch (error) {
    logger.error("analyzeResumeToJob error", { message: error.message });
    throw new Error(`Failed to analyze resume-job match with Gemini: ${error.message}`);
  }
}

export async function parseResumeToSchema(resumeText) {
  const normalizedResume = normalizeResumeText(resumeText);
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
    "summary": string
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
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = extractJsonText(response);
    if (!text) throw new Error("AI returned empty response");

    const parsed = parseJsonResponse(text);
    if (!parsed.personal || !parsed.educations || !parsed.experiences) {
      throw new Error("Incomplete schema in AI response");
    }

    logger.info(
      "AI request completed",
      buildAiMetrics({
        operation: "resume-parse",
        prompt,
        responseText: text,
        durationMs: Date.now() - startedAt,
      })
    );

    return parsed;
  } catch (error) {
    logger.error("parseResumeToSchema error", { message: error.message });
    throw new Error("Failed to parse resume structure with AI");
  }
}
