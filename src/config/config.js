import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
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
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
};
