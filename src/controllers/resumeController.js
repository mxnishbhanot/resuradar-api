import fs from "fs";
import mongoose from "mongoose";
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
import { ensureFreeTrialCounters } from "../services/trialUsageService.js";

const DISPLAY_NAME_MAX = 120;

const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (unlinkErr) {
    logger.warn("Failed to delete temp file", { filePath, message: unlinkErr.message });
  }
};

const isHistoryResumeId = (param) =>
  typeof param === "string" && /^[a-fA-F0-9]{24}$/.test(param) && mongoose.Types.ObjectId.isValid(param);

const checkStandardAnalysisQuota = async (userId, filePath) => {
  const user = await ensureFreeTrialCounters(userId);
  if (!user) {
    await removeTempFile(filePath);
    return { allowed: false, status: 404, message: "User not found", code: "USER_NOT_FOUND" };
  }
  const isPro = userHasActivePremium(user);
  if (isPro) {
    return { allowed: true, user, isPro: true };
  }
  const standardConsumed = user.freeStandardAnalysesConsumed ?? 0;
  const limit = getFreeStandardAnalysisLimit();
  if (standardConsumed >= limit) {
    await removeTempFile(filePath);
    return {
      allowed: false,
      status: 403,
      code: "FREE_ANALYSIS_LIMIT",
      message:
        "You've used your free resume analyses. Upgrade to unlock unlimited insights and match your resume with job descriptions.",
      limits: { standardUsed: standardConsumed, standardLimit: limit },
    };
  }
  return { allowed: true, user, isPro: false, standardConsumed };
};

const checkJdMatchQuota = async (userId, filePath) => {
  const user = await ensureFreeTrialCounters(userId);
  if (!user) {
    await removeTempFile(filePath);
    return { allowed: false, status: 404, message: "User not found", code: "USER_NOT_FOUND" };
  }
  const isPro = userHasActivePremium(user);
  if (isPro) {
    return { allowed: true, user, isPro: true };
  }
  const jdConsumed = user.freeJdMatchesConsumed ?? 0;
  const limit = getFreeJdMatchLimit();
  if (jdConsumed >= limit) {
    await removeTempFile(filePath);
    return {
      allowed: false,
      status: 403,
      code: "FREE_JD_MATCH_LIMIT",
      message:
        "You've used your free job match trial. Upgrade for unlimited resume-to-job-description matching and full premium insights.",
      limits: { jdUsed: jdConsumed, jdLimit: limit },
    };
  }
  return { allowed: true, user, isPro: false, jdConsumed };
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

    const { user, isPro, standardConsumed } = uploadCheck;
    const wowAt = getStandardAnalysesBeforeWow();
    const isWow =
      !isPro &&
      !user.premiumWowStandardUsed &&
      typeof standardConsumed === "number" &&
      standardConsumed === wowAt;

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

    await User.findByIdAndUpdate(userId, { $inc: { freeStandardAnalysesConsumed: 1 } });

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

    const { isPro, jdConsumed } = uploadCheck;
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

    await User.findByIdAndUpdate(userId, { $inc: { freeJdMatchesConsumed: 1 } });

    await removeTempFile(filePath);

    const includePremium = isPro || (!isPro && jdConsumed === 0);
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

export const deleteResumeHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isHistoryResumeId(id)) {
      return res.status(400).json({ success: false, message: "Invalid resume id" });
    }
    const userId = req.user.userId;
    const doc = await Resume.findOne({ _id: id, userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }
    if (doc.type !== "standard" && doc.type !== "job_match") {
      return res.status(400).json({ success: false, message: "This resume cannot be deleted here" });
    }
    await Resume.deleteOne({ _id: id, userId });
    return res.status(200).json({ success: true, message: "Resume deleted" });
  } catch (err) {
    logger.error("deleteResumeHistory error", { message: err.message, requestId: req.requestId });
    return res.status(500).json({ success: false, message: "Failed to delete resume" });
  }
};

export const patchResumeDisplayName = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isHistoryResumeId(id)) {
      return res.status(400).json({ success: false, message: "Invalid resume id" });
    }
    const raw = req.body?.displayName;
    if (raw !== null && raw !== undefined && typeof raw !== "string") {
      return res.status(400).json({ success: false, message: "displayName must be a string or null" });
    }
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed.length > DISPLAY_NAME_MAX) {
      return res.status(400).json({
        success: false,
        message: `displayName must be at most ${DISPLAY_NAME_MAX} characters`,
      });
    }
    const displayName = trimmed.length ? trimmed : null;
    const userId = req.user.userId;
    const updated = await Resume.findOneAndUpdate(
      { _id: id, userId, type: { $in: ["standard", "job_match"] } },
      { $set: { displayName } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error("patchResumeDisplayName error", { message: err.message, requestId: req.requestId });
    return res.status(500).json({ success: false, message: "Failed to update resume" });
  }
};
