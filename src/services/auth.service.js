import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

export const AUTH_COOKIE_NAME = "resuradar_session";
const ACCESS_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 12;

export const createAccessToken = (payload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: "12h" });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwtSecret);

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    path: "/",
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
  });
};
