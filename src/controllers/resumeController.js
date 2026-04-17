import fs from "fs";
import Resume from "../models/Resume.js";
import User from "../models/User.js";
import { extractText } from "../services/fileService.js";
import {
  analyzeResume,
  analyzeResumeToJob,
  GeminiModelUnavailableError,
  GeminiRateLimitError,
} from "../services/aiService.js";
import { ensureString } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import {
  userHasActivePremium,
  getFreeStandardAnalysisLimit,
  getFreeJdMatchLimit,
  getStandardAnalysesBeforeWow,
} from "../services/subscriptionAccess.js";

const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (unlinkErr) {
    logger.warn("Failed to delete temp file", { filePath, message: unlinkErr.message });
  }
};

const checkStandardAnalysisQuota = async (userId, filePath) => {
  const user = await User.findById(userId);
  if (!user) {
    await removeTempFile(filePath);
    return { allowed: false, status: 404, message: "User not found", code: "USER_NOT_FOUND" };
  }
  const isPro = userHasActivePremium(user);
  if (isPro) {
    return { allowed: true, user, isPro: true };
  }
  const standardCount = await Resume.countDocuments({ userId, type: "standard" });
  const limit = getFreeStandardAnalysisLimit();
  if (standardCount >= limit) {
    await removeTempFile(filePath);
    return {
      allowed: false,
      status: 403,
      code: "FREE_ANALYSIS_LIMIT",
      message:
        "You've used your free resume analyses. Upgrade to unlock unlimited insights and match your resume with job descriptions.",
      limits: { standardUsed: standardCount, standardLimit: limit },
    };
  }
  return { allowed: true, user, isPro: false, standardCount };
};

const checkJdMatchQuota = async (userId, filePath) => {
  const user = await User.findById(userId);
  if (!user) {
    await removeTempFile(filePath);
    return { allowed: false, status: 404, message: "User not found", code: "USER_NOT_FOUND" };
  }
  const isPro = userHasActivePremium(user);
  if (isPro) {
    return { allowed: true, user, isPro: true };
  }
  const jdCount = await Resume.countDocuments({ userId, type: "job_match" });
  const limit = getFreeJdMatchLimit();
  if (jdCount >= limit) {
    await removeTempFile(filePath);
    return {
      allowed: false,
      status: 403,
      code: "FREE_JD_MATCH_LIMIT",
      message:
        "You've used your free job match trial. Upgrade for unlimited resume-to-job-description matching and full premium insights.",
      limits: { jdUsed: jdCount, jdLimit: limit },
    };
  }
  return { allowed: true, user, isPro: false, jdCount };
};

export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const userId = req.user.userId;
    const filePath = req.file.path;
    const uploadCheck = await checkStandardAnalysisQuota(userId, filePath);
    if (!uploadCheck.allowed) {
      return res.status(uploadCheck.status).json({
        success: false,
        code: uploadCheck.code,
        message: uploadCheck.message,
        ...(uploadCheck.limits ? { limits: uploadCheck.limits } : {}),
      });
    }

    const { user, isPro, standardCount } = uploadCheck;
    const wowAt = getStandardAnalysesBeforeWow();
    const isWow =
      !isPro &&
      !user.premiumWowStandardUsed &&
      typeof standardCount === "number" &&
      standardCount === wowAt;

    const text = await extractText(filePath, req.file.mimetype);
    const analysis = await analyzeResume(text);

    const resume = await Resume.create({
      filename: req.file.originalname,
      text,
      analysis,
      score: analysis.score,
      userId,
      type: "standard",
    });

    if (isWow) {
      await User.findByIdAndUpdate(userId, { $set: { premiumWowStandardUsed: true } });
    }

    await removeTempFile(filePath);

    const includePremium = isPro || isWow;
    const payload = {
      filename: resume.filename,
      score: analysis.score,
      free_feedback: analysis.free_feedback,
    };
    if (includePremium) {
      payload.premium_feedback = analysis.premium_feedback;
    }

    return res.status(200).json({
      success: true,
      message: "Resume analyzed successfully",
      data: payload,
    });
  } catch (err) {
    await removeTempFile(req.file?.path);
    logger.error("uploadResume error", { message: err.message, requestId: req.requestId });
    if (err instanceof GeminiRateLimitError) {
      return res.status(503).json({
        success: false,
        code: err.code,
        message: err.message,
      });
    }
    if (err instanceof GeminiModelUnavailableError) {
      return res.status(502).json({
        success: false,
        code: err.code,
        message: err.message,
      });
    }
    return res.status(500).json({ success: false, message: "Failed to analyze resume" });
  }
};

export const getResumes = async (req, res) => {
  try {
    const userId = req.user.userId;
    const type = req.params.type === "jd" ? "job_match" : "standard";
    const resumes = await Resume.find({ userId, type }).sort({ createdAt: -1 });
    resumes.forEach((resume) => {
      resume.score =
        resume.score ||
        (resume.analysis && resume.analysis.free_feedback && resume.analysis.free_feedback.match_score) ||
        0;
    });
    return res.status(200).json({ success: true, data: resumes });
  } catch (err) {
    logger.error("getResumes error", { message: err.message, requestId: req.requestId });
    return res.status(500).json({ success: false, message: "Failed to fetch resumes" });
  }
};

export const matchResumeToJob = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const jobDescription = ensureString(req.body?.jobDescription, "jobDescription", {
      min: 20,
      max: 8000,
    });

    const userId = req.user.userId;
    const filePath = req.file.path;
    const uploadCheck = await checkJdMatchQuota(userId, filePath);
    if (!uploadCheck.allowed) {
      return res.status(uploadCheck.status).json({
        success: false,
        code: uploadCheck.code,
        message: uploadCheck.message,
        ...(uploadCheck.limits ? { limits: uploadCheck.limits } : {}),
      });
    }

    const { isPro, jdCount } = uploadCheck;
    const text = await extractText(filePath, req.file.mimetype);
    const analysis = await analyzeResumeToJob(text, jobDescription);

    const resume = await Resume.create({
      filename: req.file.originalname,
      text,
      analysis,
      score: analysis.match_score || analysis.score || 0,
      userId,
      type: "job_match",
    });

    await removeTempFile(filePath);

    const includePremium = isPro || (!isPro && jdCount === 0);
    const payload = {
      filename: resume.filename,
      score: resume.score,
      free_feedback: analysis.free_feedback,
    };
    if (includePremium) {
      payload.premium_feedback = analysis.premium_feedback;
    }

    return res.status(200).json({
      success: true,
      message: "Resume analyzed successfully",
      data: payload,
    });
  } catch (err) {
    await removeTempFile(req.file?.path);
    logger.error("matchResumeToJob error", { message: err.message, requestId: req.requestId });
    if (err instanceof GeminiRateLimitError) {
      return res.status(503).json({
        success: false,
        code: err.code,
        message: err.message,
      });
    }
    if (err instanceof GeminiModelUnavailableError) {
      return res.status(502).json({
        success: false,
        code: err.code,
        message: err.message,
      });
    }
    return res.status(500).json({ success: false, message: "Failed to analyze resume-job match" });
  }
};
