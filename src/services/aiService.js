import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

// Initialize Gemini client
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

console.log(
  isProd
    ? "✅ Gemini using Vertex AI (v1)"
    : "🧪 Gemini using AI Studio (v1alpha)"
);

export async function analyzeResume(resumeText) {
  // --- Step 1: Detect job field from resume text ---
  function detectField(text) {
    const lower = text.toLowerCase();

    if (/(sales|account manager|revenue|quota|crm|territory)/.test(lower)) return "Sales";
    if (/(software|developer|engineer|programming|code|javascript|python)/.test(lower)) return "Software Engineering";
    if (/(marketing|brand|campaign|seo|content)/.test(lower)) return "Marketing";
    if (/(design|ux|ui|visual|figma|adobe)/.test(lower)) return "Design";
    if (/(finance|accounting|bookkeeping|budget|audit)/.test(lower)) return "Finance";
    if (/(hr|recruitment|human resources|talent acquisition)/.test(lower)) return "Human Resources";
    if (/(operations|supply chain|logistics|process)/.test(lower)) return "Operations";

    return "General";
  }

  const detectedField = detectField(resumeText);

  // --- Step 2: Build dynamic prompt based on detected field ---
  const prompt = `
You are a professional resume reviewer specializing in ${detectedField} resumes.

First, confirm that the resume text indeed belongs to a ${detectedField} professional. 
If it seems to belong to a different field, adjust your analysis accordingly.

Your task is to analyze the following resume text and return TWO types of feedback:

1. Free Feedback — concise, motivational, and general (visible to all users)
   - Resume Score (out of 100)
   - 3 Key Strengths
   - 3 High-Level Areas for Improvement
   - Short overall summary (2–3 sentences)

2. Premium Feedback — advanced insights (behind paywall)
   - Deep analysis with specific recommendations
   - 2–3 rewritten resume bullet points
   - 3–5 portfolio/LinkedIn improvement tips
   - 5 resume keywords (for ATS)
   - A "Professional Level" (Junior / Mid-Level / Senior)

Return valid JSON only, no markdown or extra commentary. The score MUST be a numeric value between 0 and 100.

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
${resumeText}
`;

  try {
    const model = isProd ? "gemini-2.0-pro-001" : "gemini-2.0-flash-001";

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const text =
      response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.error("Gemini returned no output. Response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini returned no text");
    }

    // Clean potential markdown
    let cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in Gemini response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate score
    let score = typeof parsed.score === "string" ? parseFloat(parsed.score) : parsed.score;
    if (isNaN(score) || score < 0 || score > 100) throw new Error(`Invalid score: ${parsed.score}`);

    score = Math.round(score);

    if (!parsed.free_feedback || !parsed.premium_feedback)
      throw new Error("Incomplete or malformed JSON from Gemini");

    // --- Step 3: Return normalized result ---
    return {
      detected_field: detectedField,
      score,
      free_feedback: parsed.free_feedback,
      premium_feedback: parsed.premium_feedback,
    };
  } catch (error) {
    console.error("analyzeResume error:", error.message);
    throw new Error("Failed to analyze resume with Gemini");
  }
}


export async function analyzeResumeToJob(resumeText, jobDescription) {
  // --- Step 1: Detect job field from resume or JD ---
  function detectField(text) {
    const lower = text.toLowerCase();

    if (/(sales|account manager|crm|quota|pipeline|territory|revenue)/.test(lower)) return "Sales";
    if (/(software|developer|engineer|programming|code|javascript|python|java|react)/.test(lower)) return "Software Engineering";
    if (/(marketing|brand|campaign|seo|content|social media)/.test(lower)) return "Marketing";
    if (/(design|ux|ui|visual|figma|adobe|creative)/.test(lower)) return "Design";
    if (/(finance|accounting|bookkeeping|audit|budget|financial)/.test(lower)) return "Finance";
    if (/(hr|recruitment|human resources|talent acquisition|people operations)/.test(lower)) return "Human Resources";
    if (/(operations|logistics|supply chain|process improvement)/.test(lower)) return "Operations";
    if (/(data|analytics|machine learning|ai|statistics)/.test(lower)) return "Data / Analytics";

    return "General";
  }

  const detectedField =
    detectField(resumeText) !== "General"
      ? detectField(resumeText)
      : detectField(jobDescription);

  // --- Step 2: Dynamic prompt ---
  const prompt = `
You are a professional resume reviewer specializing in ${detectedField} roles.

Your task is to analyze how well the provided resume matches the job description. 
Extract key requirements from the JD (skills, experience, qualifications, and keywords), 
then compare them against the resume.

Return ONLY valid JSON with NO markdown, NO commentary, and NO code blocks.
The match_score MUST be numeric (not a string) between 0 and 100.

Use this exact structure:

{
  "free_feedback": {
    "match_score": 75,
    "match_level": "Good",
    "summary": "Brief overview here",
    "strengths": [
      "Strength 1",
      "Strength 2",
      "Strength 3"
    ],
    "gaps": [
      "Gap 1",
      "Gap 2",
      "Gap 3"
    ]
  },
  "premium_feedback": {
    "keyword_analysis": {
      "total_keywords_in_jd": 20,
      "matched_keywords": 15,
      "missing_keywords": [
        "Keyword 1",
        "Keyword 2"
      ]
    },
    "role_fit_breakdown": {
      "technical_skills_fit": 80,
      "experience_fit": 70,
      "education_fit": 90,
      "soft_skills_fit": 75,
      "overall_fit": 75
    },
    "recommendations": [
      "Recommendation 1",
      "Recommendation 2"
    ],
    "suggested_rewrites": [
      {
        "original": "Original text from resume",
        "suggestion": "Improved version"
      }
    ]
  }
}

Job Description:
${jobDescription}

Resume text:
${resumeText}
`;

  try {
    const model = isProd ? "gemini-2.0-pro-001" : "gemini-2.0-flash-001";

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const text =
      response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.error("Gemini returned no output. Response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini returned no text");
    }

    // --- Step 3: Clean and extract JSON safely ---
    let cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text);
      throw new Error("No valid JSON found in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // --- Step 4: Validate structure and normalize numeric fields ---
    if (!parsed.free_feedback || !parsed.premium_feedback) {
      throw new Error("Missing required sections: free_feedback or premium_feedback");
    }

    let score = parsed.free_feedback.match_score;
    if (typeof score === "string") score = parseFloat(score);
    if (isNaN(score) || score < 0 || score > 100)
      throw new Error(`Invalid match_score: ${parsed.free_feedback.match_score}`);
    score = Math.round(score);

    // Validate expected keys
    const freeKeys = ["match_level", "summary", "strengths", "gaps"];
    for (const key of freeKeys) {
      if (!parsed.free_feedback.hasOwnProperty(key)) {
        throw new Error(`Missing key in free_feedback: ${key}`);
      }
    }

    const premiumKeys = [
      "keyword_analysis",
      "role_fit_breakdown",
      "recommendations",
      "suggested_rewrites",
    ];
    for (const key of premiumKeys) {
      if (!parsed.premium_feedback.hasOwnProperty(key)) {
        throw new Error(`Missing key in premium_feedback: ${key}`);
      }
    }

    // Normalize role fit breakdown
    const fitKeys = [
      "technical_skills_fit",
      "experience_fit",
      "education_fit",
      "soft_skills_fit",
    ];
    fitKeys.forEach((k) => {
      if (parsed.premium_feedback.role_fit_breakdown[k] !== undefined) {
        let val = parsed.premium_feedback.role_fit_breakdown[k];
        if (typeof val === "string") val = parseFloat(val);
        parsed.premium_feedback.role_fit_breakdown[k] = Math.round(val);
      }
    });

    // Sync overall_fit with score
    parsed.premium_feedback.role_fit_breakdown.overall_fit = score;

    // --- Step 5: Return clean, structured output ---
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
    console.error("❌ analyzeResumeToJob error:", error.message);
    console.error("Full error:", error);
    throw new Error(`Failed to analyze resume-job match with Gemini: ${error.message}`);
  }
}


