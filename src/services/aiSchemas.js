import { Type } from "@google/genai";

/** Max output tokens per flow (caps latency and cost for verbose completions). */
export const AI_MAX_OUTPUT_TOKENS = {
  resumeAnalysis: 4096,
  resumeJobMatch: 4096,
  resumeParse: 8192,
};

export const resumeAnalysisResponseSchema = {
  type: Type.OBJECT,
  required: ["score", "free_feedback", "premium_feedback"],
  properties: {
    score: { type: Type.NUMBER, description: "Score from 0 to 100" },
    free_feedback: {
      type: Type.OBJECT,
      required: ["strengths", "improvements", "summary"],
      properties: {
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
        summary: { type: Type.STRING },
      },
    },
    premium_feedback: {
      type: Type.OBJECT,
      required: ["detailed_suggestions", "rewrites", "portfolio_tips", "keywords", "professional_level"],
      properties: {
        detailed_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        rewrites: { type: Type.ARRAY, items: { type: Type.STRING } },
        portfolio_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        professional_level: { type: Type.STRING },
      },
    },
  },
};

const rewritePairSchema = {
  type: Type.OBJECT,
  required: ["original", "suggestion"],
  properties: {
    original: { type: Type.STRING },
    suggestion: { type: Type.STRING },
  },
};

export const resumeJobMatchResponseSchema = {
  type: Type.OBJECT,
  required: ["free_feedback", "premium_feedback"],
  properties: {
    free_feedback: {
      type: Type.OBJECT,
      required: ["match_score", "match_level", "summary", "strengths", "gaps"],
      properties: {
        match_score: { type: Type.NUMBER },
        match_level: { type: Type.STRING },
        summary: { type: Type.STRING },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    premium_feedback: {
      type: Type.OBJECT,
      required: ["keyword_analysis", "role_fit_breakdown", "recommendations", "suggested_rewrites"],
      properties: {
        keyword_analysis: {
          type: Type.OBJECT,
          required: ["total_keywords_in_jd", "matched_keywords", "missing_keywords"],
          properties: {
            total_keywords_in_jd: { type: Type.NUMBER },
            matched_keywords: { type: Type.NUMBER },
            missing_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        role_fit_breakdown: {
          type: Type.OBJECT,
          required: ["technical_skills_fit", "experience_fit", "education_fit", "soft_skills_fit", "overall_fit"],
          properties: {
            technical_skills_fit: { type: Type.NUMBER },
            experience_fit: { type: Type.NUMBER },
            education_fit: { type: Type.NUMBER },
            soft_skills_fit: { type: Type.NUMBER },
            overall_fit: { type: Type.NUMBER },
          },
        },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggested_rewrites: { type: Type.ARRAY, items: rewritePairSchema },
      },
    },
  },
};

const personalSchema = {
  type: Type.OBJECT,
  required: ["firstName", "lastName", "email", "phone", "location", "headline", "summary"],
  properties: {
    firstName: { type: Type.STRING },
    lastName: { type: Type.STRING },
    email: { type: Type.STRING },
    phone: { type: Type.STRING },
    location: { type: Type.STRING },
    headline: { type: Type.STRING },
    summary: { type: Type.STRING },
  },
};

const educationItemSchema = {
  type: Type.OBJECT,
  required: ["school", "degree", "field", "startYear", "endYear", "description"],
  properties: {
    school: { type: Type.STRING },
    degree: { type: Type.STRING },
    field: { type: Type.STRING },
    startYear: { type: Type.STRING },
    endYear: { type: Type.STRING },
    description: { type: Type.STRING },
  },
};

const experienceItemSchema = {
  type: Type.OBJECT,
  required: ["title", "company", "startDate", "endDate", "isCurrent", "bullets"],
  properties: {
    title: { type: Type.STRING },
    company: { type: Type.STRING },
    startDate: { type: Type.STRING },
    endDate: { type: Type.STRING },
    isCurrent: { type: Type.BOOLEAN },
    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

const skillItemSchema = {
  type: Type.OBJECT,
  required: ["name", "level"],
  properties: {
    name: { type: Type.STRING },
    level: { type: Type.STRING },
  },
};

const projectItemSchema = {
  type: Type.OBJECT,
  required: ["title", "link", "description", "tech"],
  properties: {
    title: { type: Type.STRING },
    link: { type: Type.STRING },
    description: { type: Type.STRING },
    tech: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

export const resumeParseResponseSchema = {
  type: Type.OBJECT,
  required: ["personal", "educations", "experiences", "skills", "projects"],
  properties: {
    personal: personalSchema,
    educations: { type: Type.ARRAY, items: educationItemSchema },
    experiences: { type: Type.ARRAY, items: experienceItemSchema },
    skills: { type: Type.ARRAY, items: skillItemSchema },
    projects: { type: Type.ARRAY, items: projectItemSchema },
  },
};
