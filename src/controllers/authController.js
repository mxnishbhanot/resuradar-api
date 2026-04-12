import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { config } from "../config/config.js";
import { clearAuthCookie, createAccessToken, setAuthCookie } from "../services/auth.service.js";
import { logger } from "../utils/logger.js";

const googleClient = new OAuth2Client(config.googleClientId);

export const googleAuth = async (req, res) => {
  try {
    const { token, idToken } = req.body;
    const authToken = token || idToken;
    if (!authToken) {
      return res.status(400).json({ message: "Google token is required" });
    }

    let userInfo;

    if (idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken: authToken,
        audience: config.googleClientId,
      });
      const payload = ticket.getPayload();
      userInfo = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } else {
      const googleRes = await axios.get(
        `${config.googleBaseUrl}/v1/userinfo?alt=json&access_token=${authToken}`,
        { timeout: 8000 }
      );
      userInfo = {
        googleId: googleRes.data.id,
        email: googleRes.data.email,
        name: googleRes.data.name,
        picture: googleRes.data.picture,
      };
    }

    let user = await User.findOne({ googleId: userInfo.googleId });
    if (!user) {
      user = await User.create({
        ...userInfo,
        isPremium: false,
        joinedAt: new Date(),
      });
    } else {
      await User.findByIdAndUpdate(user._id, {
        name: userInfo.name,
        picture: userInfo.picture,
      });
      user.name = userInfo.name;
      user.picture = userInfo.picture;
    }

    const appToken = createAccessToken({ userId: user._id, email: user.email });
    setAuthCookie(res, appToken);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    logger.warn("googleAuth failed", { message: err.response?.data || err.message });
    return res.status(401).json({ message: "Invalid or expired Google token" });
  }
};

export const logout = async (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};
