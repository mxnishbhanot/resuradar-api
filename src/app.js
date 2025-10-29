import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/routes.js";

dotenv.config();

const app = express();

// ---------- Middleware ----------
app.use(cors()); // enable CORS
app.use(express.json({ limit: "10mb" })); // parse JSON requests
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")); // logging format

// ---------- Routes ----------
app.use("/api", routes);

// ---------- Health Check ----------
app.get("/", (req, res) => {
  res.status(200).send("🚀 Resume Analyzer API is running...");
});

// ---------- Global Error Handler (optional safety net) ----------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default app;
