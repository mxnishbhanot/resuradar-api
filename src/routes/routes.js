import express from "express";
import multer from "multer";
import { uploadResume, getResumes, matchResumeToJob } from "../controllers/resumeController.js";
import { googleAuth } from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { initiatePayment } from "../controllers/paymentController.js";
import { verifyPayment } from "../controllers/verifyPaymentController.js";
import { getUser } from "../controllers/userController.js";
import { submitContact } from "../controllers/contactController.js";

const router = express.Router();

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ---------- Auth ----------
router.post("/auth/google", googleAuth);

// ---------- User ----------
router.get("/user/me", verifyToken, getUser);

// ---------- Resume ----------
router.post("/resumes/upload", verifyToken,  upload.single("resume"), uploadResume);
router.post("/resumes/match", verifyToken,  upload.single("resume"), matchResumeToJob);
router.get("/resumes", verifyToken, getResumes);

// ---------- Payments ----------
router.post("/initiate-payment", verifyToken, initiatePayment);
router.get("/verify-payment/:orderId", verifyToken, verifyPayment);

//---------- Public ----------
router.post("/contact", submitContact);


export default router;
