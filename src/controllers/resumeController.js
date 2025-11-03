import fs from "fs";
import Resume from "../models/Resume.js";
import User from "../models/User.js"; // ✅ make sure you have a User model
import { extractText } from "../services/fileService.js";
import { analyzeResume } from "../services/aiService.js";

export const uploadResume = async (req, res) => {
  try {
    // ✅ Ensure a file is uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const userId = req.user.userId;
    const filePath = req.file.path;

    // ✅ Check user subscription & resume upload limit
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch how many resumes this user has uploaded
    const resumeCount = await Resume.countDocuments({ userId });

    // Allow only 3 uploads for free users
    if (!user.isPremium && resumeCount >= 3) {
      // delete uploaded file immediately to free storage
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn("Failed to delete temp file:", unlinkErr.message);
      }

      return res.status(403).json({
        success: false,
        message:
          "You have reached your free upload limit (3 resumes). Upgrade to premium to upload more.",
      });
    }

    // ✅ Extract text from uploaded resume file
    const text = await extractText(filePath, req.file.mimetype);

    // ✅ Analyze the resume text via AI service
    const analysis = await analyzeResume(text);

    // ✅ Store resume and AI analysis in MongoDB
    const resume = await Resume.create({
      filename: req.file.originalname,
      text,
      analysis,
      score: analysis.score,
      userId,
    });

    // ✅ Delete temporary uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkErr) {
      console.warn("Failed to delete temp file:", unlinkErr.message);
    }

    // ✅ Return structured response
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
    const userId = req.user.userId;
    const resumes = await Resume.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: resumes });
  } catch (err) {
    console.error("getResumes error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch resumes" });
  }
};
