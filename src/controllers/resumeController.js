import fs from "fs";
import Resume from "../models/Resume.js";
import { extractText } from "../services/fileService.js";
import { analyzeResume } from "../services/aiService.js";

export const uploadResume = async (req, res) => {
  try {
    // Ensure file is present
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;

    // Extract text from uploaded file
    const text = await extractText(filePath, req.file.mimetype);

    // Analyze resume content
    const analysis = await analyzeResume(text);

    // Save analysis in database
    const resume = await Resume.create({
      filename: req.file.originalname,
      text,
      analysis,
      score: analysis.score,
      userId: req.user.userId,
    });

    // Delete temp file safely
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkErr) {
      console.warn("Failed to delete temp file:", unlinkErr.message);
    }


    // Send response
    return res.status(200).json({
      success: true,
      message: "Resume analyzed successfully",
      data: {
        filename: resume.filename,
        score: analysis.score,
        free_feedback: analysis.free_feedback,
        premium_feedback: analysis.premium_feedback,
      },
    });
  } catch (err) {
    console.error("uploadResume error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to analyze resume" });
  }
};

export const getResumes = async (req, res) => {
  try {
    const resumes = await Resume.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: resumes });
  } catch (err) {
    console.error("getResumes error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch resumes" });
  }
};
