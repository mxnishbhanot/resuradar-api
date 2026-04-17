import dotenv from "dotenv";
dotenv.config();

const required = (key, { minLength = 1 } = {}) => {
  const value = process.env[key];
  if (!value || value.trim().length < minLength) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

const csvList = (value, fallback) =>
  String(value || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  port: process.env.PORT || 5000,
  isProduction: process.env.NODE_ENV === "production",
  phonepeBase: process.env.PHONEPE_BASE,
  clientId: process.env.MERCHANT_ID,
  clientSecret: process.env.SECRET,
  saltKey: process.env.SALT_KEY,
  redirectUrl: process.env.REDIRECT_URL,
  clientVersion: process.env.PHONEPE_CLIENT_VERSION || "1",

  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleBaseUrl: "https://www.googleapis.com/oauth2",

  jwtSecret: required("JWT_SECRET", { minLength: 32 }),
  premiumPlanId: process.env.PREMIUM_PLAN_ID || "premium_monthly",
  premiumPlanAmountInr: Number(process.env.PREMIUM_PLAN_AMOUNT_INR || "499"),
  /** First subscription charge in paisa (default: rupees * 100). Override for GST-inclusive totals. */
  premiumSetupAmountPaisa: Number(
    process.env.PREMIUM_SETUP_AMOUNT_PAISA || String(Math.round(Number(process.env.PREMIUM_PLAN_AMOUNT_INR || "499") * 100))
  ),
  gstDisplayNote: process.env.GST_DISPLAY_NOTE || "+ GST",

  freeStandardAnalysisLimit: Number(process.env.FREE_STANDARD_ANALYSIS_LIMIT || "5"),
  freeJdMatchLimit: Number(process.env.FREE_JD_MATCH_LIMIT || "1"),
  /** When current standard count equals this (before a new run), the next analysis is the "wow" (0-based: 1 => second analysis). */
  standardAnalysesBeforeWow: Number(process.env.STANDARD_ANALYSES_BEFORE_WOW || "1"),
  subscriptionPeriodDays: Number(process.env.SUBSCRIPTION_PERIOD_DAYS || "30"),

  freeBuilderTemplates: csvList(process.env.FREE_BUILDER_TEMPLATES, "modern,corporate,faang"),

  phonepeWebhookUsername: process.env.PHONEPE_WEBHOOK_USERNAME || "",
  phonepeWebhookPassword: process.env.PHONEPE_WEBHOOK_PASSWORD || "",
};

export const getPhonepeOAuthTokenUrl = () =>
  config.isProduction
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
