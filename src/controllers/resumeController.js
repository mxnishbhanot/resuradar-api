// controllers/resumeController.js
import fs from "fs";
import Resume from "../models/Resume.js";
import { extractText } from "../services/fileService.js";
import { analyzeResume } from "../services/aiService.js";

export const uploadResume = async (req, res) => {
  try {
    const filePath = req.file.path;
    const text = await extractText(filePath, req.file.mimetype);

    const analysis = await analyzeResume(text);

    // Save to DB
    const saved = await Resume.create({
      filename: req.file.originalname,
      text,
      analysis, // full structured object
      score: analysis.score,
    });

    fs.unlinkSync(filePath); // remove temp file

    res.json({
      message: "Resume analyzed successfully",
      data: {
        filename: saved.filename,
        score: analysis.score,
        free_feedback: analysis.free_feedback,
        premium_feedback: analysis.premium_feedback,
      },
    });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getResumes = async (req, res) => {
  const resumes = await Resume.find().sort({ createdAt: -1 });
  res.json(resumes);
};
