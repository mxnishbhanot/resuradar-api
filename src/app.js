import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/routes.js";
import { encryptionMiddleware } from "./middlewares/encryptionMiddleware.js";

dotenv.config();
const app = express();

const allowedOrigins = [
  "https://resuradar-frontend.onrender.com",
  "https://resuradar-api.onrender.com",
];

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:4300");
  allowedOrigins.push("http://127.0.0.1:4300");
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`❌ CORS blocked for origin: ${origin}`);
      return callback(new Error("CORS not allowed for this origin"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Encrypted"],
  })
);

app.options(/.*/, cors());


app.use(express.json({ limit: "10mb" }));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(encryptionMiddleware);

app.use("/api", routes);

app.get("/", (req, res) => {
  res.status(200).send("🚀 Resume Analyzer API is running...");
});

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default app;
