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
   - Resume Score (out of 10)
   - 3 Key Strengths
   - 3 High-Level Areas for Improvement
   - Short overall summary (2–3 sentences)

2. Premium Feedback — advanced insights (behind paywall)
   - Deep analysis with specific recommendations
   - 2–3 rewritten resume bullet points
   - 3–5 portfolio/LinkedIn improvement tips
   - 5 resume keywords (for ATS)
   - A “Professional Level” (Junior / Mid-Level / Senior)

Return valid JSON only, no markdown or extra commentary.

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

    // Extract JSON structure from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in Gemini response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required keys
    if (
      typeof parsed.score !== "number" ||
      !parsed.free_feedback ||
      !parsed.premium_feedback
    ) {
      throw new Error("Incomplete or malformed JSON from Gemini");
    }

    return parsed;
  } catch (error) {
    console.error("analyzeResume error:", error.message);
    throw new Error("Failed to analyze resume with Gemini");
  }
}
