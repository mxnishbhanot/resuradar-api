import express from "express";
import multer from "multer";
import { uploadResume, getResumes, matchResumeToJob } from "../controllers/resumeController.js";
import { googleAuth, logout } from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { initiatePayment } from "../controllers/paymentController.js";
import { verifyPayment } from "../controllers/verifyPaymentController.js";
import { getUser } from "../controllers/userController.js";
import { submitContact } from "../controllers/contactController.js";
import {
  autoSaveCustomResumeDraft,
  completeCustomResume,
  deleteCustomResume,
  duplicateCustomResume,
  fetchAllCustomResumes,
  getCustomResume,
  getCustomResumeDraft,
  previewResumeController,
  saveCustomResume,
  uploadCustomResume,
} from "../controllers/customResumeController.js";
import { exportResumeController } from "../controllers/export.controller.js";
import { createRateLimiter } from "../middlewares/rateLimitMiddleware.js";
import { HttpError, asyncHandler } from "../utils/httpError.js";

const router = express.Router();

const createDiskUpload = (fileFilter, maxSize = 5 * 1024 * 1024) =>
  multer({
    dest: "uploads/",
    limits: { fileSize: maxSize, files: 1 },
    fileFilter,
  });

const pdfOnlyUpload = createDiskUpload((req, file, cb) => {
  if (file.mimetype === "application/pdf") return cb(null, true);
  return cb(new HttpError(400, "Only PDF uploads are allowed"));
});

const builderUpload = createDiskUpload((req, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowed.includes(file.mimetype) || file.mimetype.includes("wordprocessing")) {
    return cb(null, true);
  }

  return cb(new HttpError(400, "Unsupported resume file type"));
});

const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: "auth" });
const paymentLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: "payment" });
const uploadLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 12, keyPrefix: "upload" });
const publicFormLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 8, keyPrefix: "contact" });

router.post("/auth/google", authLimiter, asyncHandler(googleAuth));
router.post("/auth/logout", asyncHandler(logout));

router.get("/user/me", verifyToken, asyncHandler(getUser));

router.post("/resumes/upload", verifyToken, uploadLimiter, pdfOnlyUpload.single("resume"), asyncHandler(uploadResume));
router.post("/resumes/match", verifyToken, uploadLimiter, pdfOnlyUpload.single("resume"), asyncHandler(matchResumeToJob));
router.get("/resumes/:type", verifyToken, asyncHandler(getResumes));

router.get("/custom-resume/pdf", verifyToken, asyncHandler(exportResumeController));
router.get("/custom-resume/draft", verifyToken, asyncHandler(getCustomResumeDraft));
router.put("/custom-resume/draft/autosave", verifyToken, asyncHandler(autoSaveCustomResumeDraft));
router.post("/custom-resume/save", verifyToken, asyncHandler(saveCustomResume));
router.get("/custom-resume/all", verifyToken, asyncHandler(fetchAllCustomResumes));
router.get("/custom-resume/:template/:resumeId", verifyToken, asyncHandler(previewResumeController));
router.get("/custom-resume/:id", verifyToken, asyncHandler(getCustomResume));
router.put("/custom-resume/:id", verifyToken, asyncHandler(saveCustomResume));
router.delete("/custom-resume/:id", verifyToken, asyncHandler(deleteCustomResume));
router.post("/custom-resume/:id/duplicate", verifyToken, asyncHandler(duplicateCustomResume));
router.post("/custom-resume/:id/complete", verifyToken, asyncHandler(completeCustomResume));
router.post("/custom-resume/upload", verifyToken, uploadLimiter, builderUpload.single("resume"), asyncHandler(uploadCustomResume));

router.post("/initiate-payment", verifyToken, paymentLimiter, asyncHandler(initiatePayment));
router.get("/verify-payment/:orderId", verifyToken, paymentLimiter, asyncHandler(verifyPayment));

router.post("/contact", publicFormLimiter, asyncHandler(submitContact));

export default router;
