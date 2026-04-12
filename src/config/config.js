import dotenv from "dotenv";
dotenv.config();

const required = (key, { minLength = 1 } = {}) => {
  const value = process.env[key];
  if (!value || value.trim().length < minLength) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

export const config = {
  port: process.env.PORT || 5000,
  isProduction: process.env.NODE_ENV === "production",
  // PhonePe API configuration
  phonepeBase: process.env.PHONEPE_BASE,
  clientId: process.env.MERCHANT_ID,
  clientSecret: process.env.SECRET,
  saltKey: process.env.SALT_KEY,
  redirectUrl: process.env.REDIRECT_URL,

  // Google OAuth configuration
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleBaseUrl: 'https://www.googleapis.com/oauth2',

  // JWT configuration
  jwtSecret: required("JWT_SECRET", { minLength: 32 }),
  premiumPlanId: process.env.PREMIUM_PLAN_ID || "premium_monthly",
  premiumPlanAmountInr: Number(process.env.PREMIUM_PLAN_AMOUNT_INR || "10"),
};
