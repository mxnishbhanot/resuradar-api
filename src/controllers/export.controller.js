import CustomResume from "../models/CustomResume.js";
import { exportResumeService } from "../services/export.service.js";

export const exportResumeController = async (req, res) => {
  try {
    const { resumeId, template } = req.query;

    if (!resumeId || !template)
      return res.status(400).json({ message: "Resume resumeId and template name required" });

    const resume = await CustomResume.findOne({ _id: resumeId, userId: req.user.userId });

    if (!resume)
      return res.status(404).json({ message: "Custom resume not found" });

    const pdfBuffer = await exportResumeService(resume, template);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=resume.pdf"
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to export PDF" });
  }
};
