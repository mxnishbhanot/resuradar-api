import { HttpError } from "../utils/httpError.js";

const buckets = new Map();

export const createRateLimiter = ({ windowMs, maxRequests, keyPrefix }) => {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      return next(new HttpError(429, "Too many requests, please try again later"));
    }

    return next();
  };
};
