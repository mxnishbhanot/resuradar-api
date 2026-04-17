import express from "express";
import { asyncHandler } from "../utils/httpError.js";
import { handlePhonePeWebhook } from "../controllers/phonepeWebhookController.js";

const router = express.Router();
router.post("/", asyncHandler(handlePhonePeWebhook));

export default router;
