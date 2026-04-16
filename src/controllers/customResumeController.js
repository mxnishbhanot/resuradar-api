import CustomResume from "../models/CustomResume.js";
import fs from "fs";
import { parseResumeToSchema, GeminiModelUnavailableError, GeminiRateLimitError } from "../services/aiService.js";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { renderTemplateHTML } from "../services/template-engine.js";
import { normalizeParsedResume } from "../services/resumeNormalizer.js";
import { ensureEnum, sanitizeObjectId } from "../utils/validation.js";
import { logger } from "../utils/logger.js";

const allowedTemplates = ["modern", "corporate", "minimal", "faang", "luxury", "magazine", "executive", "creative"];
const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {}
};

export const getCustomResumeDraft = async (req, res) => {
  try {
    const resume = await CustomResume.findOne({
      userId: req.user.userId,
      isDraft: true,
    }).sort({ updatedAt: -1 });

    if (!resume) {
      return res.json({ resume: null, message: "No active draft found." });
    }

    res.json({ resume });
  } catch (error) {
    logger.error("Get draft error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to fetch draft" });
  }
};

export const autoSaveCustomResumeDraft = async (req, res) => {
  try {
    const { _id, personal, educations, experiences, skills, projects } = req.body;
    let resume;

    if (_id) {
      resume = await CustomResume.findOne({
        _id,
        userId: req.user.userId,
      });

      if (!resume) {
        logger.warn("Draft id missing, creating a new draft", {
          resumeId: _id,
          userId: req.user.userId,
          requestId: req.requestId,
        });
        resume = new CustomResume({ userId: req.user.userId, isDraft: true });
      }
    } else {
      resume = new CustomResume({ userId: req.user.userId, isDraft: true });
    }

    if (personal) resume.personal = personal;
    if (educations) resume.educations = educations;
    if (experiences) resume.experiences = experiences;
    if (skills) resume.skills = skills;
    if (projects) resume.projects = projects;

    resume.isDraft = true;
    resume.lastAutoSaveAt = new Date();
    resume.calculateCompletion();
    await resume.save();

    res.json({
      message: "Draft auto-saved",
      resume,
      savedAt: resume.lastAutoSaveAt,
    });
  } catch (error) {
    logger.error("Auto-save error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to auto-save draft" });
  }
};

export const saveCustomResume = async (req, res) => {
  try {
    const { _id, personal, educations, experiences, skills, projects, isDraft } = req.body;
    let resume;

    if (_id) {
      resume = await CustomResume.findOne({ _id, userId: req.user.userId });
      if (!resume) {
        return res.status(404).json({ error: "Resume not found for save" });
      }
    } else {
      resume = new CustomResume({ userId: req.user.userId });
    }

    resume.personal = personal;
    resume.educations = educations || [];
    resume.experiences = experiences || [];
    resume.skills = skills || [];
    resume.projects = projects || [];
    resume.isDraft = isDraft !== undefined ? isDraft : false;

    resume.calculateCompletion();
    await resume.save();

    res.json({
      message: "Resume saved successfully",
      resume,
    });
  } catch (error) {
    logger.error("Save error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to save resume" });
  }
};

export const fetchAllCustomResumes = async (req, res) => {
  try {
    const resumes = await CustomResume.find({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .select("-__v");

    res.json({ resumes });
  } catch (error) {
    logger.error("Get all resumes error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
};

export const getCustomResume = async (req, res) => {
  try {
    const resume = await CustomResume.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({ resume });
  } catch (error) {
    logger.error("Get resume error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to fetch resume" });
  }
};

export const updateCustomResume = async (req, res) => {
  try {
    const resume = await CustomResume.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const { personal, educations, experiences, skills, projects, isDraft } = req.body;
    if (personal) resume.personal = personal;
    if (educations) resume.educations = educations;
    if (experiences) resume.experiences = experiences;
    if (skills) resume.skills = skills;
    if (projects) resume.projects = projects;
    if (isDraft !== undefined) resume.isDraft = isDraft;

    resume.calculateCompletion();
    await resume.save();

    res.json({
      message: "Resume updated successfully",
      resume,
    });
  } catch (error) {
    logger.error("Update resume error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to update resume" });
  }
};

export const deleteCustomResume = async (req, res) => {
  try {
    const resume = await CustomResume.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({ message: "Resume deleted successfully" });
  } catch (error) {
    logger.error("Delete resume error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to delete resume" });
  }
};

export const duplicateCustomResume = async (req, res) => {
  try {
    const original = await CustomResume.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!original) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const duplicate = new CustomResume({
      userId: req.user.userId,
      personal: original.personal,
      educations: original.educations,
      experiences: original.experiences,
      skills: original.skills,
      projects: original.projects,
      isDraft: true,
    });

    duplicate.calculateCompletion();
    await duplicate.save();

    res.json({
      message: "Resume duplicated successfully",
      resume: duplicate,
    });
  } catch (error) {
    logger.error("Duplicate resume error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to duplicate resume" });
  }
};

export const completeCustomResume = async (req, res) => {
  try {
    const resume = await CustomResume.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    resume.isDraft = false;
    resume.calculateCompletion();
    await resume.save();

    res.json({
      message: "Resume marked as complete",
      resume,
    });
  } catch (error) {
    logger.error("Complete resume error", { message: error.message, requestId: req.requestId });
    res.status(500).json({ error: "Failed to complete resume" });
  }
};

export const uploadCustomResume = async (req, res) => {
  try {
    if (!req.file || !req.user.userId) {
      return res.status(400).json({ error: "File and authentication required" });
    }

    let rawText = "";
    if (req.file.mimetype === "application/pdf") {
      const data = new PDFParse({ url: req.file.path });
      const result = await data.getText();
      rawText = result.text;
    } else if (
      req.file.mimetype.includes("wordprocessing") ||
      req.file.mimetype === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ path: req.file.path });
      rawText = result.value;
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: "Empty or unreadable resume file" });
    }

    const structuredData = await parseResumeToSchema(rawText);
    const normalizedResume = normalizeParsedResume(structuredData);

    const newResume = new CustomResume({
      userId: req.user.userId,
      ...normalizedResume,
      isDraft: true,
    });

    newResume.calculateCompletion();
    await newResume.save();

    const resumeState = {
      _id: newResume._id,
      personal: newResume.personal || {},
      educations: newResume.educations || [],
      experiences: newResume.experiences || [],
      skills: newResume.skills || [],
      projects: newResume.projects || [],
    };

    res.json({
      success: true,
      resume: resumeState,
      id: newResume._id,
    });
    await removeTempFile(req.file.path);
  } catch (error) {
    await removeTempFile(req.file?.path);
    logger.error("Upload parsing error", { message: error.message, requestId: req.requestId });
    if (error instanceof GeminiRateLimitError) {
      return res.status(503).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    if (error instanceof GeminiModelUnavailableError) {
      return res.status(502).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    return res.status(500).json({ error: "AI failed to parse resume. Try a clearer PDF." });
  }
};

export const previewResumeController = async (req, res) => {
  try {
    const template = ensureEnum(req.params.template, "template", allowedTemplates);
    const resumeId = sanitizeObjectId(req.params.resumeId, "resumeId");

    const resume = await CustomResume.findOne({
      _id: resumeId,
      userId: req.user.userId,
    });

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const cleanData = JSON.parse(JSON.stringify(resume));
    const html = await renderTemplateHTML(cleanData, template);

    res.set("Content-Type", "text/html");
    return res.send(html);
  } catch (err) {
    logger.error("Preview error", { message: err.message, requestId: req.requestId });
    return res.status(500).json({ message: "Failed to generate preview" });
  }
};
