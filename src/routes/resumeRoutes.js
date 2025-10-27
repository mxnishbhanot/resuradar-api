import express from "express";
import multer from "multer";
import { uploadResume, getResumes } from "../controllers/resumeController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("resume"), uploadResume);
router.get("/", getResumes);

export default router;
