import CustomResume from "../models/CustomResume.js";
import { exportResumeService } from "../services/export.service.js";
import { ensureEnum, sanitizeObjectId } from "../utils/validation.js";

const allowedTemplates = ["modern", "corporate", "minimal", "faang", "luxury", "magazine", "executive", "creative"];

export const exportResumeController = async (req, res) => {
  try {
    const resumeId = sanitizeObjectId(req.query.resumeId, "resumeId");
    const template = ensureEnum(req.query.template, "template", allowedTemplates);

    const resume = await CustomResume.findOne({ _id: resumeId, userId: req.user.userId });
    if (!resume) {
      return res.status(404).json({ message: "Custom resume not found" });
    }

    const pdfBuffer = await exportResumeService(resume, template);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=resume.pdf",
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).json({ message: "Failed to export PDF", error: err.message });
  }
};
