import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/routes.js";
import { requestContextMiddleware } from "./middlewares/requestContextMiddleware.js";
import { securityHeadersMiddleware } from "./middlewares/securityHeadersMiddleware.js";
import { HttpError } from "./utils/httpError.js";
import { logger } from "./utils/logger.js";

dotenv.config();
const app = express();

const allowedOrigins = [
  "https://resuradar-frontend.onrender.com",
  "https://resuradar-api.onrender.com",
  "https://resuradar-api-production.up.railway.app",
  "https://resuradar-frontend-production.up.railway.app",
];

if (process.env.VERCEL_FRONTEND_URL) {
  allowedOrigins.push(process.env.VERCEL_FRONTEND_URL);
}

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:4300");
  allowedOrigins.push("http://127.0.0.1:4300");
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed for this origin"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(/.*/, cors());

app.use(requestContextMiddleware);
app.use(securityHeadersMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api", routes);

app.get("/", (req, res) => {
  res.status(200).send("Resume Analyzer API is running");
});

app.use((err, req, res, next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : "Internal Server Error";

  logger.error("Unhandled error", {
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method,
    status,
    message,
    details: err instanceof HttpError ? err.details : undefined,
  });

  res.status(status).json({
    success: false,
    message,
    requestId: req.requestId,
    ...(err instanceof HttpError && err.details ? { details: err.details } : {}),
  });
});

export default app;
