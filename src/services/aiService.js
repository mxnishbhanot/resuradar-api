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
  const prompt = `
You are a professional tech resume reviewer specializing in software engineering resumes.

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
    // Select model based on environment
    const model = isProd ? "gemini-2.0-pro-001" : "gemini-2.0-flash-001";

    // Send request to Gemini
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    // Extract generated text safely
    const text =
      response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.error("Gemini returned no output. Response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini returned no text");
    }

    // Remove markdown code blocks if present
    let cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Extract JSON structure from text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in Gemini response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize score
    let score = parsed.score;

    // Convert string to number if needed
    if (typeof score === "string") {
      score = parseFloat(score);
    }

    // Validate it's a valid number between 0-100
    if (typeof score !== "number" || isNaN(score) || score < 0 || score > 100) {
      console.error("Invalid score:", parsed.score, "Type:", typeof parsed.score);
      throw new Error(`Invalid score: ${parsed.score}`);
    }

    // Round to integer
    score = Math.round(score);

    // Validate required keys
    if (!parsed.free_feedback || !parsed.premium_feedback) {
      throw new Error("Incomplete or malformed JSON from Gemini");
    }

    // Return normalized result
    return {
      score,
      free_feedback: parsed.free_feedback,
      premium_feedback: parsed.premium_feedback
    };
  } catch (error) {
    console.error("analyzeResume error:", error.message);
    throw new Error("Failed to analyze resume with Gemini");
  }
}

export async function analyzeResumeToJob(resumeText, jobDescription) {
  const prompt = `
You are a professional tech resume reviewer specializing in matching software engineering resumes to job descriptions.

Your task is to analyze how well the provided resume matches the job description. Extract key requirements from the JD (skills, experience, keywords, etc.) and compare them to the resume.

CRITICAL: Return ONLY valid JSON with NO markdown formatting, NO backticks, NO explanatory text.
The match_score MUST be a numeric value (not a string), between 0 and 100.

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

    // Remove markdown code blocks if present
    let cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Extract JSON from text safely
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text);
      throw new Error("No valid JSON found in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // ✅ Validate main structure
    if (!parsed.free_feedback || !parsed.premium_feedback) {
      throw new Error("Missing required sections: free_feedback or premium_feedback");
    }

    // ✅ Validate and normalize match_score
    let score = parsed.free_feedback.match_score;

    // Convert string to number if needed
    if (typeof score === "string") {
      score = parseFloat(score);
    }

    // Validate it's a valid number
    if (typeof score !== "number" || isNaN(score) || score < 0 || score > 100) {
      console.error("Invalid match_score:", parsed.free_feedback.match_score, "Type:", typeof parsed.free_feedback.match_score);
      throw new Error(`Invalid match_score in free_feedback: ${parsed.free_feedback.match_score}`);
    }

    // Round to integer
    score = Math.round(score);

    // ✅ Validate free_feedback keys
    const freeKeys = ["match_level", "summary", "strengths", "gaps"];
    for (const key of freeKeys) {
      if (!parsed.free_feedback.hasOwnProperty(key)) {
        throw new Error(`Missing required key in free_feedback: ${key}`);
      }
    }

    // ✅ Validate premium_feedback keys
    const premiumKeys = [
      "keyword_analysis",
      "role_fit_breakdown",
      "recommendations",
      "suggested_rewrites",
    ];
    for (const key of premiumKeys) {
      if (!parsed.premium_feedback.hasOwnProperty(key)) {
        throw new Error(`Missing required key in premium_feedback: ${key}`);
      }
    }

    // ✅ Validate arrays are non-empty
    // if (
    //   !Array.isArray(parsed.premium_feedback.suggested_rewrites) ||
    //   parsed.premium_feedback.suggested_rewrites.length === 0
    // ) {
    //   throw new Error("suggested_rewrites must be a non-empty array");
    // }

    if (
      !Array.isArray(parsed.free_feedback.strengths) ||
      parsed.free_feedback.strengths.length === 0
    ) {
      throw new Error("strengths must be a non-empty array");
    }

    if (
      !Array.isArray(parsed.free_feedback.gaps) ||
      parsed.free_feedback.gaps.length === 0
    ) {
      throw new Error("gaps must be a non-empty array");
    }

    // ✅ Ensure overall_fit matches match_score
    if (parsed.premium_feedback.role_fit_breakdown) {
      parsed.premium_feedback.role_fit_breakdown.overall_fit = score;
    }

    // ✅ Normalize all numeric fields in role_fit_breakdown
    const fitKeys = ["technical_skills_fit", "experience_fit", "education_fit", "soft_skills_fit"];
    for (const key of fitKeys) {
      if (parsed.premium_feedback.role_fit_breakdown[key] !== undefined) {
        let val = parsed.premium_feedback.role_fit_breakdown[key];
        if (typeof val === "string") {
          val = parseFloat(val);
        }
        parsed.premium_feedback.role_fit_breakdown[key] = Math.round(val);
      }
    }

    // ✅ Return normalized structure
    const result = {
      match_score: score,
      match_level: parsed.free_feedback.match_level,
      free_feedback: {
        ...parsed.free_feedback,
        match_score: score
      },
      premium_feedback: parsed.premium_feedback,
    };

    // console.log("✅ analyzeResumeToJob completed successfully:", result);
    return result;

  } catch (error) {
    console.error("❌ analyzeResumeToJob error:", error.message);
    console.error("Full error:", error);
    throw new Error(`Failed to analyze resume-job match with Gemini: ${error.message}`);
  }
}

