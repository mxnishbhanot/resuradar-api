import { AUTH_COOKIE_NAME, verifyAccessToken } from "../services/auth.service.js";

const parseCookies = (cookieHeader = "") =>
  cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...value] = part.split("=");
      acc[key] = decodeURIComponent(value.join("="));
      return acc;
    }, {});

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[AUTH_COOKIE_NAME];
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    const token = cookieToken || bearerToken;
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
