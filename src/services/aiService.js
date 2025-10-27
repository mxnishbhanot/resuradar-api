// services/aiService.js
import axios from "axios";

export const analyzeResume = async (text) => {
  const model = "minimax/minimax-m2:free";
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";

  const prompt = `
You are a professional tech resume reviewer specializing in software engineering resumes.

Your task is to analyze the following resume text and return TWO types of feedback:
1. **Free Feedback** — concise, motivational, and general (visible to all users)
   - Resume Score (out of 10)
   - 3 Key Strengths
   - 3 High-Level Areas for Improvement
   - Short overall summary (2–3 sentences)

2. **Premium Feedback** — advanced insights (behind paywall)
   - Deep analysis with specific recommendations
   - 2–3 rewritten resume bullet points
   - 3–5 portfolio/LinkedIn improvement tips
   - 5 resume keywords (for ATS)
   - A “Professional Level” (Junior / Mid-Level / Senior)

Return only **valid JSON** with this structure (no markdown, no commentary, no explanations):

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
${text}
`;

  const body = {
    model,
    messages: [
      { role: "system", content: "You are a professional resume reviewer." },
      { role: "user", content: prompt },
    ],
  };

  try {
    const response = await axios.post(endpoint, body, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const raw = response.data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("No content from AI");

    // 🔒 Clean and extract only JSON from messy responses
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in AI response");

    const cleaned = jsonMatch[0]
      .replace(/```json|```/g, "")
      .replace(/<think>[\s\S]*?<\/think>/g, "") // remove reasoning tags
      .trim();

    const parsed = JSON.parse(cleaned);

    return parsed;
  } catch (error) {
    console.error("AI service failed:", error.response?.data || error.message);
    throw new Error("AI service failed");
  }
};
