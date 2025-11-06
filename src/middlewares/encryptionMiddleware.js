import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
const ENCRYPTION_KEY = Buffer.from(
  String(process.env.ENCRYPTION_KEY)
);
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return { iv: iv.toString("base64"), data: encrypted };
}

function decrypt(encryptedData) {
  const iv = Buffer.from(encryptedData.iv, "base64");
  const encryptedText = Buffer.from(encryptedData.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export const encryptionMiddleware = (req, res, next) => {
  const isMultipart = req.is("multipart/form-data");

  // ✅ Decrypt incoming JSON (skip for multipart/form-data)
  if (!isMultipart && ["POST", "PUT", "PATCH"].includes(req.method) && req.body?.iv && req.body?.data) {
    try {
      const decryptedText = decrypt(req.body);
      req.body = JSON.parse(decryptedText);
    } catch (err) {
      console.error("❌ Failed to decrypt request:", err.message);
      return res.status(400).json({ success: false, message: "Invalid encrypted request" });
    }
  }

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    try {
      const plaintext = JSON.stringify(data);
      const encrypted = encrypt(plaintext);
      return originalJson(encrypted);
    } catch (err) {
      console.error("❌ Failed to encrypt response:", err.message);
      return originalJson({ success: false, message: "Response encryption failed" });
    }
  };

  next();
};
