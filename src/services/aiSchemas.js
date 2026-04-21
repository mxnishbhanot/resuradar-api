import { Type } from "@google/genai";

/** Max output tokens per flow (caps latency and cost for verbose completions). */
export const AI_MAX_OUTPUT_TOKENS = {
  resumeAnalysis: 4096,
  resumeJobMatch: 4096,
  resumeParse: 8192,
};

const resumeScoreFactorSchema = {
  type: Type.OBJECT,
  required: ["name", "impact", "note"],
  properties: {
    name: { type: Type.STRING, description: "Short factor label e.g. Impact of achievements" },
    impact: {
      type: Type.STRING,
      description: "Exactly one of: high, medium, low — how much this factor lowered or raised the score",
    },
    note: { type: Type.STRING, description: "One plain-language sentence; must align with the numeric score" },
  },
};

/** Before/after line rewrites — used for resume premium rewrites and job-match suggested_rewrites. */
const rewritePairSchema = {
  type: Type.OBJECT,
  required: ["original", "suggestion"],
  properties: {
    original: {
      type: Type.STRING,
      description:
        "Exact or lightly trimmed quote from the resume (one bullet or sentence). Must appear in the resume text.",
    },
    suggestion: {
      type: Type.STRING,
      description:
        "Improved replacement. Do not invent metrics or percentages not in the resume; use placeholders like [metric] or say what to measure.",
    },
  },
};

export const resumeAnalysisResponseSchema = {
  type: Type.OBJECT,
  required: ["score", "free_feedback", "premium_feedback"],
  properties: {
    score: { type: Type.NUMBER, description: "Score from 0 to 100" },
    free_feedback: {
      type: Type.OBJECT,
      required: ["strengths", "improvements", "summary", "score_explanation"],
      properties: {
        strengths: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description:
              "One strength anchored to the resume (e.g. Experience → Company: …). No generic filler unless tied to evidence on the document.",
          },
        },
        improvements: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description:
              "One concrete improvement naming section or role (e.g. Projects → X: …). Say what to change; avoid invented numbers.",
          },
        },
        summary: {
          type: Type.STRING,
          description: "Short executive summary grounded in this resume only; no markdown",
        },
        score_explanation: {
          type: Type.STRING,
          description: "1-3 sentences explaining why this score was chosen; plain language, no markdown",
        },
        score_factors: {
          type: Type.ARRAY,
          items: resumeScoreFactorSchema,
          description: "2-5 key drivers of the score; each note must align with the numeric score",
        },
      },
    },
    premium_feedback: {
      type: Type.OBJECT,
      required: ["detailed_suggestions", "rewrites", "portfolio_tips", "keywords", "professional_level"],
      properties: {
        detailed_suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description:
              "One complete actionable suggestion (roughly 80-800 characters). Never split one suggestion across multiple array entries.",
          },
        },
        rewrites: { type: Type.ARRAY, items: rewritePairSchema },
        portfolio_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "ATS-relevant terms supported by or reasonably adjacent to the resume; empty array if none",
        },
        professional_level: {
          type: Type.STRING,
          description:
            "Short phrase for how the resume reads (e.g. Mid-level full-stack engineer); not a hiring guarantee",
        },
      },
    },
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
        match_score: { type: Type.NUMBER, description: "0-100 alignment of resume to this job description" },
        match_level: { type: Type.STRING, description: "Short label aligned with match_score (e.g. Good, Fair)" },
        summary: {
          type: Type.STRING,
          description: "2-4 sentences grounded in resume + JD; no markdown",
        },
        strengths: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "Overlap or evidence tying resume to JD; avoid generic praise",
          },
        },
        gaps: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "Concrete gap vs JD (skill, proof, seniority); avoid vague filler",
          },
        },
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
            total_keywords_in_jd: {
              type: Type.NUMBER,
              description: "Count of salient role keywords extracted from the job summary",
            },
            matched_keywords: {
              type: Type.NUMBER,
              description: "How many of those appear or are clearly implied on the resume; must be <= total",
            },
            missing_keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "JD terms the resume does not substantiate; empty array if none",
            },
          },
        },
        role_fit_breakdown: {
          type: Type.OBJECT,
          required: ["technical_skills_fit", "experience_fit", "education_fit", "soft_skills_fit", "overall_fit"],
          properties: {
            technical_skills_fit: { type: Type.NUMBER, description: "0-100 vs JD technical needs" },
            experience_fit: { type: Type.NUMBER, description: "0-100 vs JD scope/seniority" },
            education_fit: { type: Type.NUMBER, description: "0-100 vs JD education signals" },
            soft_skills_fit: { type: Type.NUMBER, description: "0-100 vs JD collaboration/communication cues" },
            overall_fit: { type: Type.NUMBER, description: "0-100 holistic; should align with free_feedback.match_score" },
          },
        },
        recommendations: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "One complete actionable sentence per item; JD-specific where possible",
          },
        },
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
    linkedin: { type: Type.STRING },
    github: { type: Type.STRING },
    portfolioUrl: { type: Type.STRING },
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
  required: ["title", "company", "startDate", "isCurrent", "bullets"],
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
