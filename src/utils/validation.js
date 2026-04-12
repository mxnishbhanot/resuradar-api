import { HttpError } from "./httpError.js";

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

export const ensureString = (value, field, { min = 1, max = 5000, optional = false } = {}) => {
  if ((value === undefined || value === null || value === "") && optional) return "";
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);

  const normalized = value.trim();
  if (!optional && normalized.length < min) throw new HttpError(400, `${field} is required`);
  if (normalized.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return normalized;
};

export const ensureEmail = (value, field = "email") => {
  const email = ensureString(value, field, { max: 320 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, `${field} is invalid`);
  }
  return email.toLowerCase();
};

export const ensureEnum = (value, field, allowedValues) => {
  const normalized = ensureString(value, field, { max: 100 });
  if (!allowedValues.includes(normalized)) {
    throw new HttpError(400, `${field} must be one of: ${allowedValues.join(", ")}`);
  }
  return normalized;
};

export const ensurePositiveNumber = (value, field) => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new HttpError(400, `${field} must be a positive number`);
  }
  return number;
};

export const ensureObject = (value, field) => {
  if (!isPlainObject(value)) throw new HttpError(400, `${field} must be an object`);
  return value;
};

export const sanitizeObjectId = (value, field = "id") => {
  const normalized = ensureString(value, field, { max: 100 });
  if (!/^[a-fA-F0-9]{24}$/.test(normalized)) {
    throw new HttpError(400, `${field} must be a valid identifier`);
  }
  return normalized;
};
