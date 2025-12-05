import express from "express";
import multer from "multer";
import { uploadResume, getResumes, matchResumeToJob } from "../controllers/resumeController.js";
import { googleAuth } from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { initiatePayment } from "../controllers/paymentController.js";
import { verifyPayment } from "../controllers/verifyPaymentController.js";
import { getUser } from "../controllers/userController.js";
import { submitContact } from "../controllers/contactController.js";
import { autoSaveCustomResumeDraft, completeCustomResume, deleteCustomResume, duplicateCustomResume, fetchAllCustomResumes, getCustomResume, getCustomResumeDraft, previewResumeController, saveCustomResume, uploadCustomResume } from "../controllers/customResumeController.js";
import { exportResumeController } from "../controllers/export.controller.js";

const router = express.Router();

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ---------- Auth ----------
router.post("/auth/google", googleAuth);

// ---------- User ----------
router.get("/user/me", verifyToken, getUser);

// ---------- Resume ----------
router.post("/resumes/upload", verifyToken, upload.single("resume"), uploadResume);
router.post("/resumes/match", verifyToken, upload.single("resume"), matchResumeToJob);
router.get("/resumes/:type", verifyToken, getResumes);

// ---------- Custom Resume ----------
router.get('/custom-resume/pdf', verifyToken,  exportResumeController)
router.get("/custom-resume/draft", verifyToken, getCustomResumeDraft); // Kept for potential fallback, though less used now
router.put("/custom-resume/draft/autosave", verifyToken, autoSaveCustomResumeDraft);
router.post("/custom-resume/save", verifyToken, saveCustomResume); // Manual Save (Create New)
router.get("/custom-resume/all", verifyToken, fetchAllCustomResumes);
router.get("/custom-resume/:template/:resumeId", verifyToken, previewResumeController);
router.get("/custom-resume/:id", verifyToken, getCustomResume);
// FIX: Redirect PUT to saveCustomResume for consistent update logic (was updateCustomResume)
router.put("/custom-resume/:id", verifyToken, saveCustomResume); // Manual Save (Update Existing)
router.delete("/custom-resume/:id", verifyToken, deleteCustomResume);
router.post("/custom-resume/:id/duplicate", verifyToken, duplicateCustomResume);
router.post("/custom-resume/:id/complete", verifyToken, completeCustomResume);
router.post("/custom-resume/upload", verifyToken, upload.single("resume"),  uploadCustomResume);

// ---------- Payments ----------
router.post("/initiate-payment", verifyToken, initiatePayment);
router.get("/verify-payment/:orderId", verifyToken, verifyPayment);

//---------- Public ----------
router.post("/contact", submitContact);


export default router;