import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();
import resumeRoutes from "./routes/resumeRoutes.js";


const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/resumes", resumeRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Resume Analyzer API is running...");
});

export default app;
