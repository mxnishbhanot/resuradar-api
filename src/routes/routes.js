import express from "express";
import multer from "multer";
import { uploadResume, getResumes } from "../controllers/resumeController.js";
import { googleAuth } from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { initiatePayment } from "../controllers/paymentController.js";
import { verifyPayment } from "../controllers/verifyPaymentController.js";
import { getUser } from "../controllers/userController.js";

const router = express.Router();

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ---------- Auth ----------
router.post("/auth/google", googleAuth);

// ---------- User ----------
router.get("/user/me", verifyToken, getUser);

// ---------- Resume ----------
router.post("/resumes/upload", upload.single("resume"), uploadResume);
router.get("/resumes", verifyToken, getResumes);

// ---------- Payments ----------
router.post("/initiate-payment", verifyToken, initiatePayment);
router.get("/verify-payment/:orderId", verifyToken, verifyPayment);

export default router;
