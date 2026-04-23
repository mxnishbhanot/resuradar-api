import CustomResume from "../models/CustomResume.js";
import User from "../models/User.js";
import { exportResumeService } from "../services/export.service.js";
import { ALLOWED_RESUME_TEMPLATE_IDS } from "../config/print-spec.js";
import { ensureEnum, sanitizeObjectId } from "../utils/validation.js";
import { HttpError } from "../utils/httpError.js";
import { userHasActivePremium, isFreeBuilderTemplate } from "../services/subscriptionAccess.js";

export const exportResumeController = async (req, res) => {
  try {
    const resumeId = sanitizeObjectId(req.query.resumeId, "resumeId");
    const template = ensureEnum(req.query.template, "template", ALLOWED_RESUME_TEMPLATE_IDS);

    const user = await User.findById(req.user.userId);
    if (!userHasActivePremium(user) && !isFreeBuilderTemplate(template)) {
      return res.status(403).json({
        success: false,
        code: "TEMPLATE_PREMIUM_ONLY",
        message:
          "PDF export is not available on your current plan. Upgrade to export your resume.",
      });
    }

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
    if (err instanceof HttpError) throw err;
    console.error("Export Error:", err);
    res.status(500).json({ message: "Failed to export PDF", error: err.message });
  }
};
